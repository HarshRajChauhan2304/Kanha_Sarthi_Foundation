import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import { getFallbackPath } from '@/lib/db-fallback';
import { requireAuth } from '@/lib/rbac';
import { logAuditEvent } from '@/lib/audit-logger';

const getLocalTasks = (): any[] => {
  try {
    const dataPath = getFallbackPath('volunteer_tasks.json');
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, 'utf-8');
      return JSON.parse(fileContent);
    }
  } catch (e) {
    console.error("Error reading local volunteer tasks JSON:", e);
  }
  return [];
};

const saveLocalTasks = (tasks: any[]) => {
  try {
    const dataPath = getFallbackPath('volunteer_tasks.json');
    fs.writeFileSync(dataPath, JSON.stringify(tasks, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing local volunteer tasks JSON:", e);
  }
};

// Helper to decode metadata from task_description
const parseTaskMeta = (task: any) => {
  if (!task || !task.task_description) return task;
  const desc = task.task_description;
  if (typeof desc === 'string' && desc.includes('__META__:')) {
    const [cleanDesc, metaStr] = desc.split('__META__:');
    try {
      const meta = JSON.parse(metaStr.trim());
      return {
        ...task,
        task_description: cleanDesc.trim(),
        ...meta
      };
    } catch (e) {
      return task;
    }
  }
  return task;
};

// GET tasks
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const volunteerIdStr = searchParams.get('volunteer_id');
    const volunteerId = volunteerIdStr ? parseInt(volunteerIdStr, 10) : null;
    const volunteerEmail = searchParams.get('email') ? searchParams.get('email')!.toLowerCase() : null;

    let tasks: any[] = [];
    let supabaseSucceeded = false;

    // 1. Try Supabase via admin client (bypasses RLS)
    try {
      let query = supabaseAdmin.from('volunteer_tasks').select('*');
      if (volunteerId !== null && !isNaN(volunteerId)) {
        query = query.eq('volunteer_id', volunteerId);
      }
      const { data, error } = await query.order('id', { ascending: false });

      if (!error && Array.isArray(data)) {
        tasks = data.map(parseTaskMeta);
        supabaseSucceeded = true;
      } else if (error) {
        console.warn("Supabase tasks GET warning:", error.message);
      }
    } catch (err: any) {
      console.warn("Supabase tasks GET error:", err.message);
    }

    // 2. Merge local fallback tasks
    const local = getLocalTasks();
    let filteredLocal = local;
    if (volunteerId !== null && !isNaN(volunteerId)) {
      filteredLocal = local.filter(t => 
        String(t.volunteer_id) === String(volunteerId) || 
        (volunteerEmail && t.donor_email && t.donor_email.toLowerCase() === volunteerEmail)
      );
    }

    // Merge only unique tasks (by id)
    filteredLocal.forEach(lt => {
      if (!tasks.some(st => String(st.id) === String(lt.id))) {
        tasks.push(parseTaskMeta(lt));
      }
    });

    // Sort descending by id
    tasks.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    return NextResponse.json({ success: true, tasks });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST new task - Admin Only
export async function POST(request: Request) {
  const auth = await requireAuth(request, ['admin']);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error || "Administrator privileges required to assign tasks." },
      { status: auth.status }
    );
  }
  try {
    const body = await request.json();
    const { 
      volunteer_id, task_title, task_description, task_date, task_time, assigned_money,
      donor_name, donor_email, donation_id, cause, quantity, donation_amount, is_premium, premium_file
    } = body;

    if (!volunteer_id || !task_title || !task_date || !task_time) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Pack extra fields into metadata string
    const meta: any = {};
    if (donor_name) meta.donor_name = donor_name;
    if (donor_email) meta.donor_email = donor_email;
    if (donation_id) meta.donation_id = donation_id;
    if (cause) meta.cause = cause;
    if (quantity) meta.quantity = quantity;
    if (donation_amount) meta.donation_amount = donation_amount;
    if (is_premium !== undefined) meta.is_premium = !!is_premium;
    if (premium_file) meta.premium_file = premium_file;

    const baseDesc = (task_description || "").trim();
    const fullDescription = Object.keys(meta).length > 0
      ? (baseDesc ? `${baseDesc}\n__META__:${JSON.stringify(meta)}` : `__META__:${JSON.stringify(meta)}`)
      : baseDesc;

    const volIdNum = parseInt(String(volunteer_id), 10);
    const assignedMoneyNum = parseFloat(String(assigned_money)) || 0;

    let savedTask: any = null;

    // 1. Insert in Supabase using valid columns only
    try {
      const { data, error } = await supabaseAdmin
        .from('volunteer_tasks')
        .insert([{
          volunteer_id: !isNaN(volIdNum) ? volIdNum : null,
          task_title: task_title.trim(),
          task_description: fullDescription || null,
          task_date: String(task_date).trim(),
          task_time: String(task_time).trim(),
          status: "Pending",
          assigned_money: assignedMoneyNum,
          money_received: 0,
          money_spent: 0
        }])
        .select()
        .single();

      if (!error && data) {
        savedTask = parseTaskMeta(data);
      } else if (error) {
        console.warn("Supabase tasks insert warning:", error.message);
      }
    } catch (dbErr: any) {
      console.warn("Supabase tasks insert error:", dbErr.message);
    }

    // 2. If Supabase succeeded or fallback
    if (!savedTask) {
      savedTask = {
        id: Date.now(),
        volunteer_id: !isNaN(volIdNum) ? volIdNum : null,
        task_title: task_title.trim(),
        task_description: baseDesc,
        task_date,
        task_time,
        status: "Pending",
        assigned_money: assignedMoneyNum,
        ...meta,
        created_at: new Date().toISOString()
      };
    }

    // Update local JSON fallback
    const local = getLocalTasks();
    local.unshift(savedTask);
    saveLocalTasks(local);

    return NextResponse.json({ success: true, task: savedTask });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT edit task - Admin or Assigned Volunteer
export async function PUT(request: Request) {
  const auth = await requireAuth(request, ['admin', 'volunteer']);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error || "Authentication required." },
      { status: auth.status }
    );
  }
  try {
    const body = await request.json();
    const { 
      id, volunteer_id, task_title, task_description, task_date, task_time, status, assigned_money, 
      money_received, money_spent, proof_media, feedback, admin_verified,
      donor_name, donor_email, donation_id, cause, quantity, donation_amount, is_premium, premium_file, beneficiary_name
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID missing" }, { status: 400 });
    }

    const idNum = parseInt(String(id), 10);

    // Pack extra fields into metadata
    const meta: any = {};
    if (donor_name !== undefined) meta.donor_name = donor_name;
    if (donor_email !== undefined) meta.donor_email = donor_email;
    if (donation_id !== undefined) meta.donation_id = donation_id;
    if (cause !== undefined) meta.cause = cause;
    if (quantity !== undefined) meta.quantity = quantity;
    if (donation_amount !== undefined) meta.donation_amount = donation_amount;
    if (is_premium !== undefined) meta.is_premium = !!is_premium;
    if (premium_file !== undefined) meta.premium_file = premium_file;
    if (beneficiary_name !== undefined) meta.beneficiary_name = beneficiary_name;
    if (admin_verified !== undefined) meta.admin_verified = !!admin_verified;

    let fullDescription: string | undefined = undefined;
    if (task_description !== undefined) {
      const baseDesc = (task_description || "").trim();
      fullDescription = Object.keys(meta).length > 0
        ? (baseDesc ? `${baseDesc}\n__META__:${JSON.stringify(meta)}` : `__META__:${JSON.stringify(meta)}`)
        : baseDesc;
    }

    const updateFields: any = {};
    if (volunteer_id !== undefined && !isNaN(parseInt(volunteer_id, 10))) {
      updateFields.volunteer_id = parseInt(volunteer_id, 10);
    }
    if (task_title !== undefined) updateFields.task_title = task_title;
    if (fullDescription !== undefined) updateFields.task_description = fullDescription;
    if (task_date !== undefined) updateFields.task_date = task_date;
    if (task_time !== undefined) updateFields.task_time = task_time;
    if (status !== undefined) updateFields.status = status;
    if (assigned_money !== undefined) updateFields.assigned_money = parseFloat(assigned_money) || 0;
    if (money_received !== undefined) updateFields.money_received = parseFloat(money_received) || 0;
    if (money_spent !== undefined) updateFields.money_spent = parseFloat(money_spent) || 0;
    if (proof_media !== undefined) updateFields.proof_media = proof_media;
    if (feedback !== undefined) updateFields.feedback = feedback;

    let updatedResult: any = null;

    // 1. Update in Supabase
    try {
      if (!isNaN(idNum) && Object.keys(updateFields).length > 0) {
        const { data, error } = await supabaseAdmin
          .from('volunteer_tasks')
          .update(updateFields)
          .eq('id', idNum)
          .select()
          .single();

        if (!error && data) {
          updatedResult = parseTaskMeta(data);
        } else if (error) {
          console.warn("Supabase tasks update warning:", error.message);
        }
      }
    } catch (dbErr: any) {
      console.warn("Supabase tasks update error:", dbErr.message);
    }

    // 2. Update locally
    const local = getLocalTasks();
    const idx = local.findIndex(t => String(t.id) === String(id));
    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        ...updateFields,
        ...(task_description !== undefined ? { task_description } : {}),
        ...meta
      };
      if (!updatedResult) {
        updatedResult = local[idx];
      }
      saveLocalTasks(local);
    }

    return NextResponse.json({ 
      success: true, 
      task: updatedResult || body 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE task - Admin Only
export async function DELETE(request: Request) {
  const auth = await requireAuth(request, ['admin']);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error || "Administrator privileges required to delete tasks." },
      { status: auth.status }
    );
  }
  try {
    const { searchParams } = new URL(request.url);
    let idStr = searchParams.get('id');

    // Also check request body if not in query params
    if (!idStr) {
      try {
        const body = await request.json();
        idStr = body?.id;
      } catch (e) {}
    }

    if (!idStr) {
      return NextResponse.json({ success: false, error: "ID missing" }, { status: 400 });
    }

    const idNum = parseInt(String(idStr), 10);

    // 1. Delete in Supabase
    try {
      if (!isNaN(idNum)) {
        const { error } = await supabaseAdmin
          .from('volunteer_tasks')
          .delete()
          .eq('id', idNum);

        if (error) {
          console.warn("Supabase tasks delete warning:", error.message);
        }
      }
    } catch (dbErr: any) {
      console.warn("Supabase tasks delete error:", dbErr.message);
    }

    // 2. Delete locally
    const local = getLocalTasks();
    const updatedLocal = local.filter(t => String(t.id) !== String(idStr));
    saveLocalTasks(updatedLocal);

    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

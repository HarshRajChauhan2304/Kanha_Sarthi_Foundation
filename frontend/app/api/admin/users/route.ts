import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { getResilientData, saveResilientFallback, syncVolunteerToHighlights } from '@/lib/db-fallback';
import { hashPassword } from '@/lib/security';

// Helper to read resilient JSON files (memory -> storage -> local disk)
const readLocalJSON = async (filename: string): Promise<any[]> => {
  try {
    return await getResilientData<any[]>(filename, []);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
  }
  return [];
};

// Helper to write resilient JSON files (memory + storage + local disk)
const writeLocalJSON = async (filename: string, data: any[]) => {
  try {
    await saveResilientFallback(filename, data);
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
  }
};

export async function GET() {
  try {
    // 1. Fetch Admin Accounts
    let admins: any[] = [];
    try {
      const { data } = await supabaseAdmin.from('admin_users').select('*');
      if (data) admins = data;
    } catch (e) {
      console.warn("DB Admin fetch failed, using fallback:", e);
    }
    const localAdmins = await readLocalJSON('admin_users.json');
    localAdmins.forEach(la => {
      const match = admins.find(a => a.email?.trim().toLowerCase() === la.email?.trim().toLowerCase());
      if (match) {
        if (!match.dob && la.dob) match.dob = la.dob;
        if (!match.gender && la.gender) match.gender = la.gender;
        if (!match.phone && la.phone) match.phone = la.phone;
        if (!match.password && la.password) match.password = la.password;
      } else {
        admins.push(la);
      }
    });

    // 2. Fetch Approved Volunteers
    let volunteers: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('volunteer_applications')
        .select('*')
        .eq('status', 'Approved');
      if (data) {
        volunteers = data.map((item: any) => {
          let newItem = { ...item };
          try {
            if (item.motivation && item.motivation.trim().startsWith('{')) {
              const parsed = JSON.parse(item.motivation);
              newItem.motivation = parsed.text || "";
              newItem.profile_photo = parsed.profile_photo || "";
              newItem.gender = parsed.gender || "";
            }
          } catch (e) {}
          return newItem;
        });
      }
    } catch (e) {
      console.warn("DB Volunteer fetch failed, using fallback:", e);
    }
    const localVols = (await readLocalJSON('volunteer_applications.json')).filter(v => v.status === "Approved");
    localVols.forEach(lv => {
      const match = volunteers.find(v => v.email?.trim().toLowerCase() === lv.email?.trim().toLowerCase() || String(v.id) === String(lv.id));
      if (match) {
        if (!match.dob && lv.dob) match.dob = lv.dob;
        if (!match.gender && lv.gender) match.gender = lv.gender;
        if (!match.phone && lv.phone) match.phone = lv.phone;
        if (!match.password && lv.password) match.password = lv.password;
      } else {
        volunteers.push(lv);
      }
    });

    // 3. Fetch Regular Users
    let users: any[] = [];
    try {
      const { data } = await supabaseAdmin.from('users').select('*');
      if (data) users = data;
    } catch (e) {
      console.warn("DB User fetch failed, using fallback:", e);
    }
    const localUsers = await readLocalJSON('users.json');
    localUsers.forEach(lu => {
      const match = users.find(u => u.email?.trim().toLowerCase() === lu.email?.trim().toLowerCase());
      if (match) {
        if (!match.dob && lu.dob) match.dob = lu.dob;
        if (!match.gender && lu.gender) match.gender = lu.gender;
        if (!match.phone && lu.phone) match.phone = lu.phone;
        if (!match.password && lu.password) match.password = lu.password;
      } else {
        users.push(lu);
      }
    });

    // Combine by unique email ID
    const registryMap = new Map<string, any>();

    // Load regular users
    users.forEach(u => {
      if (u.email) {
        const email = u.email.trim().toLowerCase();
        registryMap.set(email, {
          id: `user-${u.id}`,
          name: u.username || u.name || "User",
          email: u.email,
          phone: u.phone || "",
          dob: u.dob || "",
          gender: u.gender || "",
          avatar: u.avatar || "",
          created_at: u.created_at || "",
          role: "user",
          has_password: Boolean(u.password)
        });
      }
    });

    // Load volunteers
    volunteers.forEach(v => {
      if (v.email) {
        const email = v.email.trim().toLowerCase();
        registryMap.set(email, {
          id: `volunteer-${v.id}`,
          name: v.name || "Volunteer",
          email: v.email,
          phone: v.phone || "",
          dob: v.dob || "",
          gender: v.gender || "",
          avatar: v.profile_photo || "",
          created_at: v.created_at || "",
          role: "volunteer",
          has_password: Boolean(v.password)
        });
      }
    });

    // Load admins
    admins.forEach(a => {
      if (a.email) {
        const email = a.email.trim().toLowerCase();
        registryMap.set(email, {
          id: `admin-${a.id || a.username}`,
          name: a.username || "Admin",
          email: a.email,
          phone: a.phone || "",
          dob: a.dob || "",
          gender: a.gender || "",
          role: "admin",
          has_password: Boolean(a.password)
        });
      }
    });

    const allUsers = Array.from(registryMap.values());

    return NextResponse.json({ success: true, users: allUsers });
  } catch (error: any) {
    console.error("Unified users list error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, email, phone, password, role, dob, gender, avatar } = body;

    if (!username || !email || !password || !role) {
      return NextResponse.json({ success: false, error: "Username, email, password, and role are required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const targetRole = role.trim().toLowerCase();

    // 1. Delete from all tables first to avoid duplicates
    try {
      await supabaseAdmin.from('admin_users').delete().eq('email', cleanEmail);
      await supabaseAdmin.from('volunteer_applications').delete().eq('email', cleanEmail);
      await supabaseAdmin.from('users').delete().eq('email', cleanEmail);
    } catch (e) {
      console.warn("DB deletes failed/bypassed in POST:", e);
    }

    let localAdmins = (await readLocalJSON('admin_users.json')).filter(a => a.email?.trim().toLowerCase() !== cleanEmail);
    let localVols = (await readLocalJSON('volunteer_applications.json')).filter(v => v.email?.trim().toLowerCase() !== cleanEmail);
    let localUsers = (await readLocalJSON('users.json')).filter(u => u.email?.trim().toLowerCase() !== cleanEmail);

    let dbSuccess = false;
    let newId: any = Date.now();

    const rawPassword = password && password.trim() ? password.trim() : (targetRole === "admin" ? "Admin@123" : targetRole === "volunteer" ? "Volunteer@123" : "User@123");
    const hashedPassword = hashPassword(rawPassword);

    // 2. Insert into the target role
    if (targetRole === "admin") {
      const payload = { username, email: cleanEmail, phone: phone || "", password: hashedPassword, dob: dob || "", gender: gender || "" };
      try {
        const { data, error } = await supabaseAdmin.from('admin_users').insert([{ username, email: cleanEmail, phone: phone || "", password: hashedPassword }]).select().single();
        if (!error && data) {
          dbSuccess = true;
          newId = data.id;
        }
      } catch (e) {
        console.warn("DB Admin insert failed:", e);
      }
      localAdmins.push({ id: newId, ...payload });
      await writeLocalJSON('admin_users.json', localAdmins);
    } else if (targetRole === "volunteer") {
      const payload = {
        name: username,
        email: cleanEmail,
        phone: phone || "",
        city: "Ranchi",
        motivation: "Created/Approved by Admin",
        skills: ["Food Distribution & Relief Work"],
        status: "Approved",
        password: hashedPassword,
        dob: dob || "",
        gender: gender || ""
      };
      try {
        const { data, error } = await supabaseAdmin.from('volunteer_applications').insert([payload]).select().single();
        if (!error && data) {
          dbSuccess = true;
          newId = data.id;
        }
      } catch (e) {
        console.warn("DB Volunteer insert failed:", e);
      }
      localVols.push({ id: newId, ...payload });
      await writeLocalJSON('volunteer_applications.json', localVols);
    } else {
      const payload = { username, email: cleanEmail, phone: phone || "", password: hashedPassword, dob: dob || "", gender: gender || "", avatar: avatar || "", created_at: new Date().toISOString() };
      try {
        const { data, error } = await supabaseAdmin.from('users').insert([payload]).select().single();
        if (!error && data) {
          dbSuccess = true;
          newId = data.id;
        } else {
          const { data: d2, error: e2 } = await supabaseAdmin.from('users').insert([{ username, email: cleanEmail, phone: phone || "", password: hashedPassword, avatar: avatar || "" }]).select().single();
          if (!e2 && d2) {
            dbSuccess = true;
            newId = d2.id;
          }
        }
      } catch (e) {
        console.warn("DB User insert failed:", e);
      }
      localUsers.push({ id: newId, ...payload });
      await writeLocalJSON('users.json', localUsers);
    }

    // Write back other lists to keep them clean
    await writeLocalJSON('admin_users.json', localAdmins);
    await writeLocalJSON('volunteer_applications.json', localVols);
    await writeLocalJSON('users.json', localUsers);

    return NextResponse.json({ success: true, id: `${targetRole}-${newId}` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, username, email, phone, password, role, dob, gender, avatar } = body;

    if (!id || !username || !email || !password || !role) {
      return NextResponse.json({ success: false, error: "ID, username, email, password, and role are required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const targetRole = role.trim().toLowerCase();

    // Determine old role and clean ID
    let oldRole = "user";
    let cleanId = String(id);
    if (String(id).startsWith("user-")) {
      oldRole = "user";
      cleanId = String(id).replace("user-", "");
    } else if (String(id).startsWith("volunteer-")) {
      oldRole = "volunteer";
      cleanId = String(id).replace("volunteer-", "");
    } else if (String(id).startsWith("admin-")) {
      oldRole = "admin";
      cleanId = String(id).replace("admin-", "");
    }

    // 1. If role changed: perform migrate (delete from old, insert into new)
    if (oldRole !== targetRole) {
      // Delete from DB
      try {
        if (oldRole === "admin") {
          await supabaseAdmin.from('admin_users').delete().eq('id', cleanId);
          await supabaseAdmin.from('admin_users').delete().eq('email', cleanEmail);
        } else if (oldRole === "volunteer") {
          await supabaseAdmin.from('volunteer_applications').delete().eq('id', cleanId);
          await supabaseAdmin.from('volunteer_applications').delete().eq('email', cleanEmail);
        } else {
          await supabaseAdmin.from('users').delete().eq('id', cleanId);
          await supabaseAdmin.from('users').delete().eq('email', cleanEmail);
        }
      } catch (e) {
        console.warn("DB delete old role failed:", e);
      }

      // Delete from JSON
      if (oldRole === "admin") {
        const local = (await readLocalJSON('admin_users.json')).filter(a => String(a.id) !== cleanId && a.email?.trim().toLowerCase() !== cleanEmail);
        await writeLocalJSON('admin_users.json', local);
      } else if (oldRole === "volunteer") {
        const local = (await readLocalJSON('volunteer_applications.json')).filter(v => String(v.id) !== cleanId && v.email?.trim().toLowerCase() !== cleanEmail);
        await writeLocalJSON('volunteer_applications.json', local);
      } else {
        const local = (await readLocalJSON('users.json')).filter(u => String(u.id) !== cleanId && u.email?.trim().toLowerCase() !== cleanEmail);
        await writeLocalJSON('users.json', local);
      }

      // Insert into new table
      let dbSuccess = false;
      let newId: any = Date.now();
      const hasNewPassword = Boolean(password && password.trim());
      const hashedPassword = hasNewPassword ? hashPassword(password.trim()) : hashPassword(targetRole === "admin" ? "Admin@123" : targetRole === "volunteer" ? "Volunteer@123" : "User@123");

      if (targetRole === "admin") {
        const payload = { username, email: cleanEmail, phone: phone || "", password: hashedPassword, dob: dob || "", gender: gender || "" };
        try {
          const { data } = await supabaseAdmin.from('admin_users').insert([{ username, email: cleanEmail, phone: phone || "", password: hashedPassword }]).select().single();
          if (data) { dbSuccess = true; newId = data.id; }
        } catch (e) {}
        const local = await readLocalJSON('admin_users.json');
        local.push({ id: newId, ...payload });
        await writeLocalJSON('admin_users.json', local);
      } else if (targetRole === "volunteer") {
        const payload = {
          name: username,
          email: cleanEmail,
          phone: phone || "",
          city: "Ranchi",
          motivation: "Role updated by Admin",
          skills: ["Food Distribution & Relief Work"],
          status: "Approved",
          password: hashedPassword,
          dob: dob || "",
          gender: gender || ""
        };
        try {
          const { data } = await supabaseAdmin.from('volunteer_applications').insert([payload]).select().single();
          if (data) { dbSuccess = true; newId = data.id; }
        } catch (e) {}
        const local = await readLocalJSON('volunteer_applications.json');
        local.push({ id: newId, ...payload });
        await writeLocalJSON('volunteer_applications.json', local);

        // Sync created volunteer to about highlights page
        try {
          await syncVolunteerToHighlights({
            name: payload.name,
            motivation: payload.motivation,
            profile_photo: "",
            gender: ""
          });
        } catch (e) {
          console.warn("Sync to highlights failed in admin users POST route:", e);
        }
      } else {
        const payload = { username, email: cleanEmail, phone: phone || "", password: hashedPassword, dob: dob || "", gender: gender || "" };
        try {
          const { data, error } = await supabaseAdmin.from('users').insert([payload]).select().single();
          if (!error && data) { dbSuccess = true; newId = data.id; }
          else {
            const { data: d2 } = await supabaseAdmin.from('users').insert([{ username, email: cleanEmail, phone: phone || "", password: hashedPassword }]).select().single();
            if (d2) { dbSuccess = true; newId = d2.id; }
          }
        } catch (e) {}
        const local = await readLocalJSON('users.json');
        local.push({ id: newId, ...payload });
        await writeLocalJSON('users.json', local);
      }
    } else {
      // 2. Same role: update corresponding record
      const hasNewPassword = Boolean(password && password.trim());
      const updatedHash = hasNewPassword ? hashPassword(password.trim()) : undefined;

      if (targetRole === "admin") {
        const adminUpdate: any = { username, email: cleanEmail, phone: phone || "" };
        if (hasNewPassword) adminUpdate.password = updatedHash;
        try {
          await supabaseAdmin.from('admin_users').update(adminUpdate).eq('id', cleanId);
          await supabaseAdmin.from('admin_users').update(adminUpdate).eq('email', cleanEmail);
        } catch (e) {}
        let local = await readLocalJSON('admin_users.json');
        local = local.map(a => ((cleanId && String(a.id) === cleanId) || (cleanEmail && a.email?.trim().toLowerCase() === cleanEmail)) ? { ...a, username, email: cleanEmail, phone: phone || "", ...(hasNewPassword ? { password: updatedHash } : {}), dob: dob !== undefined ? dob : (a.dob || ""), gender: gender !== undefined ? gender : (a.gender || "") } : a);
        await writeLocalJSON('admin_users.json', local);
      } else if (targetRole === "volunteer") {
        const volUpdate: any = { name: username, email: cleanEmail, phone: phone || "", dob: dob || "", gender: gender || "" };
        if (hasNewPassword) volUpdate.password = updatedHash;
        try {
          await supabaseAdmin.from('volunteer_applications').update(volUpdate).eq('id', cleanId);
          await supabaseAdmin.from('volunteer_applications').update(volUpdate).eq('email', cleanEmail);
        } catch (e) {}
        let local = await readLocalJSON('volunteer_applications.json');
        local = local.map(v => ((cleanId && String(v.id) === cleanId) || (cleanEmail && v.email?.trim().toLowerCase() === cleanEmail)) ? { ...v, name: username, email: cleanEmail, phone: phone || "", ...(hasNewPassword ? { password: updatedHash } : {}), dob: dob !== undefined ? dob : (v.dob || ""), gender: gender !== undefined ? gender : (v.gender || "") } : v);
        await writeLocalJSON('volunteer_applications.json', local);

        // Sync updated volunteer to about highlights page
        try {
          const volData = local.find(v => ((cleanId && String(v.id) === cleanId) || (cleanEmail && v.email?.trim().toLowerCase() === cleanEmail)));
          if (volData) {
            await syncVolunteerToHighlights({
              name: volData.name,
              motivation: volData.motivation,
              profile_photo: volData.profile_photo,
              gender: volData.gender
            });
          }
        } catch (e) {
          console.warn("Sync to highlights failed in admin users PUT route:", e);
        }
      } else {
        const userUpdate: any = { username, email: cleanEmail, phone: phone || "", dob: dob || "", gender: gender || "", avatar: avatar !== undefined ? avatar : "" };
        if (hasNewPassword) userUpdate.password = updatedHash;
        try {
          const { error } = await supabaseAdmin.from('users').update(userUpdate).eq('id', cleanId);
          if (error) {
            delete userUpdate.dob;
            await supabaseAdmin.from('users').update(userUpdate).eq('id', cleanId);
          }
          await supabaseAdmin.from('users').update(userUpdate).eq('email', cleanEmail);
        } catch (e) {}
        let local = await readLocalJSON('users.json');
        let matched = false;
        local = local.map(u => {
          if ((cleanId && String(u.id) === cleanId) || (cleanEmail && u.email?.trim().toLowerCase() === cleanEmail)) {
            matched = true;
            return { ...u, username, email: cleanEmail, phone: phone || "", ...(hasNewPassword ? { password: updatedHash } : {}), dob: dob !== undefined ? dob : (u.dob || ""), gender: gender !== undefined ? gender : (u.gender || ""), avatar: avatar !== undefined ? avatar : (u.avatar || "") };
          }
          return u;
        });
        if (!matched) {
          local.push({ id: cleanId || Date.now(), username, email: cleanEmail, phone: phone || "", password: updatedHash || hashPassword("User@123"), dob: dob || "", gender: gender || "", avatar: avatar || "", created_at: new Date().toISOString() });
        }
        await writeLocalJSON('users.json', local);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const emailParam = searchParams.get('email');

    if (!id && !emailParam) {
      return NextResponse.json({ success: false, error: "ID or email is required." }, { status: 400 });
    }

    let cleanId = id ? String(id) : "";
    let targetRole = "user";
    if (String(id).startsWith("user-")) {
      targetRole = "user";
      cleanId = String(id).replace("user-", "");
    } else if (String(id).startsWith("volunteer-")) {
      targetRole = "volunteer";
      cleanId = String(id).replace("volunteer-", "");
    } else if (String(id).startsWith("admin-")) {
      targetRole = "admin";
      cleanId = String(id).replace("admin-", "");
    }

    // Resolve target email if not directly provided
    let targetEmail = emailParam ? emailParam.trim().toLowerCase() : "";
    if (!targetEmail && cleanId) {
      // 1. Check in resilient JSON
      const u1 = (await readLocalJSON('users.json')).find(u => String(u.id) === cleanId);
      if (u1?.email) targetEmail = u1.email.trim().toLowerCase();

      if (!targetEmail) {
        const v1 = (await readLocalJSON('volunteer_applications.json')).find(v => String(v.id) === cleanId);
        if (v1?.email) targetEmail = v1.email.trim().toLowerCase();
      }

      if (!targetEmail) {
        const a1 = (await readLocalJSON('admin_users.json')).find(a => String(a.id) === cleanId);
        if (a1?.email) targetEmail = a1.email.trim().toLowerCase();
      }

      // 2. Check in DB
      if (!targetEmail) {
        try {
          const { data: dbU } = await supabaseAdmin.from('users').select('email').eq('id', cleanId).maybeSingle();
          if (dbU?.email) targetEmail = dbU.email.trim().toLowerCase();
          else {
            const { data: dbV } = await supabaseAdmin.from('volunteer_applications').select('email').eq('id', cleanId).maybeSingle();
            if (dbV?.email) targetEmail = dbV.email.trim().toLowerCase();
          }
        } catch (e) {}
      }
    }

    // Delete from Supabase DB by ID and by Email across all relevant tables
    try {
      if (cleanId) {
        await supabaseAdmin.from('users').delete().eq('id', cleanId);
        await supabaseAdmin.from('volunteer_applications').delete().eq('id', cleanId);
        await supabaseAdmin.from('admin_users').delete().eq('id', cleanId);
      }
      if (targetEmail) {
        await supabaseAdmin.from('users').delete().eq('email', targetEmail);
        await supabaseAdmin.from('volunteer_applications').delete().eq('email', targetEmail);
        await supabaseAdmin.from('admin_users').delete().eq('email', targetEmail);
      }
    } catch (e) {
      console.warn("DB user delete failed in /api/admin/users:", e);
    }

    // Delete from all resilient JSON files by ID AND by Email
    const isTarget = (item: any) => {
      const idMatch = cleanId && String(item.id) === cleanId;
      const emailMatch = targetEmail && item.email && item.email.trim().toLowerCase() === targetEmail;
      return idMatch || emailMatch;
    };

    const localUsers = (await readLocalJSON('users.json')).filter(u => !isTarget(u));
    await writeLocalJSON('users.json', localUsers);

    const localVols = (await readLocalJSON('volunteer_applications.json')).filter(v => !isTarget(v));
    await writeLocalJSON('volunteer_applications.json', localVols);

    const localAdmins = (await readLocalJSON('admin_users.json')).filter(a => !isTarget(a));
    await writeLocalJSON('admin_users.json', localAdmins);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

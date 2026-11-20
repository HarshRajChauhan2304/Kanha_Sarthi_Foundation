import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import { getFallbackPath, resilientDelete } from '@/lib/db-fallback';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { sanitizeString, isValidEmail } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

// GET all contact submissions - Protected Admin Only
export async function GET(request: Request) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  let submissions: any[] = [];
  let useFallback = false;

  try {
    const { data, error } = await supabaseAdmin
      .from('contact_submissions')
      .select('*')
      .order('id', { ascending: false });

    if (error || !data || data.length === 0) {
      useFallback = true;
    } else {
      submissions = data;
    }
  } catch (err) {
    useFallback = true;
  }

  if (useFallback) {
    try {
      const dataPath = getFallbackPath('contact_submissions.json');
      if (fs.existsSync(dataPath)) {
        const fileContent = fs.readFileSync(dataPath, 'utf-8');
        submissions = JSON.parse(fileContent);
        // Sort newest first by id/timestamp
        submissions.sort((a: any, b: any) => b.id - a.id);
      }
    } catch (e) {
      console.error("Failed to read contact submissions fallback JSON:", e);
    }
  }

  return NextResponse.json(submissions);
}

// POST a new contact submission from front-end form - Rate Limited & Sanitized
export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);

    // Rate Limiting: Max 10 contact messages per hour per IP
    const rateLimit = checkRateLimit(`contact:${clientIp}`, 10, 3600000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many contact submissions from your IP. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const name = sanitizeString(body?.name, 100);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = sanitizeString(body?.phone || '', 20);
    const message = sanitizeString(body?.message, 2000);

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: "Please fill in all required fields (Name, Email, Message)." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const timestampId = Date.now();

    // 1. Store in local JSON file as backup
    try {
      const dataPath = getFallbackPath('contact_submissions.json');
      let submissions = [];
      if (fs.existsSync(dataPath)) {
        const fileContent = fs.readFileSync(dataPath, 'utf-8');
        try {
          submissions = JSON.parse(fileContent);
        } catch (e) {
          submissions = [];
        }
      }
      const newSubmission = {
        id: timestampId,
        name,
        email,
        phone: phone || "",
        message,
        created_at: new Date().toISOString()
      };
      submissions.push(newSubmission);
      fs.writeFileSync(dataPath, JSON.stringify(submissions, null, 2), 'utf-8');
      console.log("Saved contact submission to local JSON backup successfully.");
    } catch (err: any) {
      console.error("Local JSON contact backup write failed:", err.message);
    }

    // 2. Store in Supabase database
    const { error } = await supabaseAdmin
      .from('contact_submissions')
      .insert([{
        id: timestampId,
        name,
        email,
        phone: phone || null,
        message
      }]);

    if (error) {
      console.warn("Supabase contact_submissions insert failed (table may not exist yet):", error.message);
      return NextResponse.json({ 
        success: true, 
        warning: "Saved locally. (Note: Ensure 'contact_submissions' table is created in Supabase: " + error.message + ")"
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE a contact submission - Protected Admin Only
export async function DELETE(request: Request) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: "ID parameter missing" }, { status: 400 });
    }

    const result = await resilientDelete({
      table: 'contact_submissions',
      idOrKey: Number(id),
      idField: 'id',
      fallbackFile: 'contact_submissions.json'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

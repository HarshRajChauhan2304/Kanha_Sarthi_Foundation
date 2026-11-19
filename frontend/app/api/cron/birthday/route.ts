import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { getFallbackPath } from '@/lib/db-fallback';

// Safely load nodemailer if available
let nodemailer: any = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer module optional
}

// Helper function to extract MM-DD from YYYY-MM-DD or string date
function getMonthDay(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // Pattern YYYY-MM-DD or DD-MM-YYYY
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD
      if (parts[0].length === 4) {
        return `${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      // DD-MM-YYYY
      if (parts[2].length === 4) {
        return `${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }

  try {
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${mm}-${dd}`;
    }
  } catch (e) {}

  return null;
}

// Nodemailer Transporter generator
function createTransporter() {
  if (!nodemailer) return null;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }
  return null;
}

async function sendBirthdayEmail(toEmail: string, name: string, userType: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const donateUrl = `${siteUrl}/donate?cause=birthday`;

  const subject = `🎉 Happy Birthday ${name}! Wish from Kanha Sarthi Foundation 🎂`;
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #18181b; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #f59e0b;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 50px;">🎂</span>
        <h1 style="color: #f59e0b; font-size: 28px; margin-top: 10px;">Happy Birthday, ${name}! 🎉</h1>
        <p style="color: #e4e4e7; font-size: 16px; line-height: 1.6;">
          On this beautiful day, the entire <strong>Kanha Sarthi Foundation</strong> family wishes you endless happiness, good health, and abundant joy!
        </p>
      </div>

      <div style="background: #27272a; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <h3 style="color: #fbbf24; margin-top: 0;">🎁 Make Your Birthday Unforgettable</h3>
        <p style="color: #d4d4d8; font-size: 14px; margin-bottom: 15px;">
          Celebrate your birthday by spreading warmth and smiles to underprivileged children in slums. Sponsoring a meal or birthday cake for slum kids turns your celebration into a lifetime memory.
        </p>
        <div style="text-align: center;">
          <a href="${donateUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #ea580c); color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 30px; font-size: 16px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);">
            Donate on My Birthday 🎁
          </a>
        </div>
      </div>

      <div style="text-align: center; margin-top: 30px; border-top: 1px solid #3f3f46; padding-top: 15px; font-size: 12px; color: #a1a1aa;">
        <p>Kanha Sarthi Foundation &copy; ${new Date().getFullYear()} | Direct Grassroots Impact</p>
      </div>
    </div>
  `;

  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Kanha Sarthi Foundation" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
        to: toEmail,
        subject,
        html: htmlContent
      });
      return { sent: true, mode: 'SMTP' };
    } catch (e: any) {
      console.error("Nodemailer send failed:", e);
    }
  }

  // Simulated Email Dispatch fallback logging
  console.log(`
=========================================================
[SIMULATED BIRTHDAY EMAIL DISPATCH]
To: ${toEmail}
Subject: ${subject}
Message: Happy Birthday ${name}! Sponsor a meal on your special day at ${donateUrl}
=========================================================
  `);
  return { sent: true, mode: 'SIMULATED' };
}

function formatWhatsAppMessage(name: string, phone: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const donateUrl = `${siteUrl}/donate?cause=birthday`;

  const messageText = `🎉 *Happy Birthday, ${name}!* 🎂%0A%0AThe *Kanha Sarthi Foundation* team wishes you a wonderful birthday filled with joy and health!%0A%0A🎁 *Make your birthday extra special:* Celebrate today by sharing smiles with slum children. Sponsor a birthday meal or cake here:%0A👉 ${donateUrl}%0A%0AWith warm wishes,%0AKanha Foundation Team`;

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const waLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${messageText}`;

  console.log(`
=========================================================
[SIMULATED WHATSAPP BIRTHDAY DISPATCH]
To Phone: ${phone} (${cleanPhone})
Message: Happy Birthday ${name}! Celebrate by giving back: ${donateUrl}
WhatsApp Direct Link: ${waLink}
=========================================================
  `);

  return { phone, cleanPhone, waLink, text: messageText };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetDate = url.searchParams.get('date');
  return handleBirthdayCheck(null, targetDate);
}

export async function POST(request: Request) {
  let body: any = null;
  try {
    body = await request.json();
  } catch (e) {}
  return handleBirthdayCheck(body);
}

async function handleBirthdayCheck(postBody?: any, customDate?: string | null) {
  try {
    // 1. Timezone-aware date calculation: Indian Standard Time (Asia/Kolkata)
    const istDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // e.g. "2026-11-20"
    const istParts = istDateStr.split('-');
    const istMMDD = `${istParts[1].padStart(2, '0')}-${istParts[2].padStart(2, '0')}`;

    const localDate = new Date();
    const localMMDD = `${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

    const targetMMDD = customDate ? getMonthDay(customDate) : null;

    const isMatch = (dateStr: string | null | undefined): boolean => {
      const mmdd = getMonthDay(dateStr);
      if (!mmdd) return false;
      if (targetMMDD) return mmdd === targetMMDD;
      return mmdd === istMMDD || mmdd === localMMDD;
    };

    // If POST body has user/volunteer info with DOB, sync it into local JSON fallback
    if (postBody && postBody.email && postBody.dob) {
      const cleanEmail = postBody.email.trim().toLowerCase();
      try {
        if (postBody.type === 'Volunteer') {
          const volJsonPath = getFallbackPath('volunteer_applications.json');
          let localVols: any[] = [];
          if (fs.existsSync(volJsonPath)) {
            localVols = JSON.parse(fs.readFileSync(volJsonPath, 'utf-8'));
          }
          const vIdx = localVols.findIndex((v: any) => v.email?.trim().toLowerCase() === cleanEmail);
          if (vIdx !== -1) {
            localVols[vIdx].dob = postBody.dob;
            if (postBody.phone) localVols[vIdx].phone = postBody.phone;
          } else {
            localVols.push({
              id: Date.now(),
              name: postBody.name || cleanEmail.split('@')[0],
              email: cleanEmail,
              phone: postBody.phone || '',
              dob: postBody.dob,
              status: 'Approved'
            });
          }
          fs.writeFileSync(volJsonPath, JSON.stringify(localVols, null, 2), 'utf-8');
        } else {
          const usersJsonPath = getFallbackPath('users.json');
          let localUsers: any[] = [];
          if (fs.existsSync(usersJsonPath)) {
            localUsers = JSON.parse(fs.readFileSync(usersJsonPath, 'utf-8'));
          }
          const uIdx = localUsers.findIndex((u: any) => u.email?.trim().toLowerCase() === cleanEmail);
          if (uIdx !== -1) {
            localUsers[uIdx].dob = postBody.dob;
            if (postBody.phone) localUsers[uIdx].phone = postBody.phone;
          } else {
            localUsers.push({
              id: Date.now(),
              username: postBody.name || cleanEmail.split('@')[0],
              email: cleanEmail,
              phone: postBody.phone || '',
              dob: postBody.dob
            });
          }
          fs.writeFileSync(usersJsonPath, JSON.stringify(localUsers, null, 2), 'utf-8');
        }
      } catch (err) {
        console.warn("Failed to sync postBody dob into fallback:", err);
      }
    }

    const birthdayRecords: Array<{ name: string; email: string; phone: string; type: string; dob: string }> = [];

    // 1. Check Users (Supabase + Local JSON with deep fallback merging)
    let users: any[] = [];
    try {
      const { data } = await supabaseAdmin.from('users').select('*');
      if (data && data.length > 0) users = data;
    } catch (e) {}

    try {
      const usersJsonPath = getFallbackPath('users.json');
      if (fs.existsSync(usersJsonPath)) {
        const localUsers = JSON.parse(fs.readFileSync(usersJsonPath, 'utf-8'));
        if (Array.isArray(localUsers)) {
          localUsers.forEach((lu: any) => {
            const match = users.find(u => u.email?.trim().toLowerCase() === lu.email?.trim().toLowerCase());
            if (match) {
              if (!match.dob && lu.dob) match.dob = lu.dob;
              if (!match.phone && lu.phone) match.phone = lu.phone;
              if (!match.username && lu.username) match.username = lu.username;
            } else {
              users.push(lu);
            }
          });
        }
      }
    } catch (e) {}

    users.forEach((u: any) => {
      if (isMatch(u.dob)) {
        birthdayRecords.push({
          name: u.username || u.name || 'Valued Member',
          email: u.email || '',
          phone: u.phone || '',
          type: 'User',
          dob: u.dob
        });
      }
    });

    // 2. Check Volunteers (Supabase + Local JSON with deep fallback merging)
    let volunteers: any[] = [];
    try {
      const { data } = await supabaseAdmin.from('volunteer_applications').select('*');
      if (data && data.length > 0) volunteers = data;
    } catch (e) {}

    try {
      const volJsonPath = getFallbackPath('volunteer_applications.json');
      if (fs.existsSync(volJsonPath)) {
        const localVols = JSON.parse(fs.readFileSync(volJsonPath, 'utf-8'));
        if (Array.isArray(localVols)) {
          localVols.forEach((lv: any) => {
            const match = volunteers.find(v => v.email?.trim().toLowerCase() === lv.email?.trim().toLowerCase() || String(v.id) === String(lv.id));
            if (match) {
              if (!match.dob && lv.dob) match.dob = lv.dob;
              if (!match.phone && lv.phone) match.phone = lv.phone;
              if (!match.name && lv.name) match.name = lv.name;
            } else {
              volunteers.push(lv);
            }
          });
        }
      }
    } catch (e) {}

    volunteers.forEach((v: any) => {
      if (isMatch(v.dob)) {
        // Avoid duplicate if registered as both user and volunteer with same email
        if (!birthdayRecords.some(r => r.email?.trim().toLowerCase() === v.email?.trim().toLowerCase())) {
          birthdayRecords.push({
            name: v.name || 'Volunteer',
            email: v.email || '',
            phone: v.phone || '',
            type: 'Volunteer',
            dob: v.dob
          });
        }
      }
    });

    // If postBody was supplied and is today's birthday, ensure it is in the list
    if (postBody && postBody.dob && isMatch(postBody.dob) && postBody.email) {
      const cleanEmail = postBody.email.trim().toLowerCase();
      if (!birthdayRecords.some(r => r.email?.trim().toLowerCase() === cleanEmail)) {
        birthdayRecords.push({
          name: postBody.name || 'Member',
          email: postBody.email,
          phone: postBody.phone || '',
          type: postBody.type || 'User',
          dob: postBody.dob
        });
      }
    }

    // 3. Process Notifications (Email & WhatsApp)
    const results = [];
    for (const record of birthdayRecords) {
      let emailRes = { sent: false, mode: 'NONE' };
      if (record.email) {
        emailRes = await sendBirthdayEmail(record.email, record.name, record.type);
      }

      let waRes = null;
      if (record.phone) {
        waRes = formatWhatsAppMessage(record.name, record.phone);
      }

      results.push({
        name: record.name,
        email: record.email,
        phone: record.phone,
        type: record.type,
        dob: record.dob,
        emailStatus: emailRes,
        whatsapp: waRes
      });
    }

    return NextResponse.json({
      success: true,
      today: istMMDD,
      totalBirthdaysToday: birthdayRecords.length,
      birthdaysProcessed: results
    });

  } catch (error: any) {
    console.error("Cron Birthday API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

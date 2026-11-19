import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import { getFallbackPath } from '@/lib/db-fallback';

// Safely load nodemailer if available
let nodemailer: any = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {}

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

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleMonthlyReminders();
}

export async function POST() {
  return handleMonthlyReminders();
}

async function handleMonthlyReminders() {
  try {
    const istDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const istDay = parseInt(istDateStr.split('-')[2], 10);
    const localDay = new Date().getDate();
    const todayDay = istDay;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kanha-foundation.org';

    // 1. Fetch donations
    let allDonations: any[] = [];
    try {
      const { data } = await supabaseAdmin.from('donations').select('*');
      if (data && data.length > 0) allDonations = data;
    } catch (_) {}

    try {
      const fallbackPath = getFallbackPath('donations.json');
      if (fs.existsSync(fallbackPath)) {
        const local = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
        if (Array.isArray(local)) {
          local.forEach((ld: any) => {
            if (!allDonations.some(d => String(d.id) === String(ld.id))) {
              allDonations.push(ld);
            }
          });
        }
      }
    } catch (_) {}

    // 2. Filter monthly donations
    const monthlyDonorsDue: any[] = [];
    const processedKeys = new Set<string>();

    allDonations.forEach((d) => {
      const title = (d.donation_for || d.title || '').toLowerCase();
      const isMonthly = title.includes('monthly') || title.includes('recurring') || title.includes('subscription');

      if (!isMonthly) return;

      // Determine day of the month from created_at or transaction_date
      let donationDay: number | null = null;
      if (d.created_at) {
        const dt = new Date(d.created_at);
        if (!isNaN(dt.getTime())) {
          donationDay = dt.getDate();
        }
      }
      if (!donationDay && d.transaction_date) {
        const match = d.transaction_date.match(/\b([1-9]|[12][0-9]|3[01])\b/);
        if (match) donationDay = parseInt(match[1], 10);
      }

      // If renewal day matches today's day of month (in IST or local time)
      if (donationDay === istDay || donationDay === localDay) {
        const donorKey = `${(d.email || '').toLowerCase()}_${(d.phone || '').replace(/[^0-9]/g, '')}`;
        if (!processedKeys.has(donorKey)) {
          processedKeys.add(donorKey);

          const donorName = d.name || 'Valued Supporter';
          const donorPhone = (d.phone || d.marketing_phone || '').replace(/[^0-9]/g, '');
          const donorEmail = (d.email || d.marketing_email || '').trim().toLowerCase();
          const amount = d.amount || '₹500';

          const waMessage = `🌸 *Namaste ${donorName} ji!* 🌸%0A%0AToday is your *Monthly Donation Renewal Day* (${todayDay}th) for *Kanha Sarthi Foundation*.%0A%0A🙏 Your recurring gift of *${amount}* ensures continuous education and nutritious meals for innocent children in need.%0A%0A👉 *Renew your monthly gift securely here:*%0A${siteUrl}/donate-monthly%0A%0AWith deep gratitude,%0AKanha Sarthi Foundation Team%0AContact/WhatsApp: +91 82587 765159`;

          const waLink = donorPhone 
            ? `https://api.whatsapp.com/send?phone=${donorPhone}&text=${waMessage}`
            : `https://api.whatsapp.com/send?phone=9182587765159&text=${waMessage}`;

          monthlyDonorsDue.push({
            id: d.id,
            name: donorName,
            email: donorEmail,
            phone: donorPhone,
            amount: amount,
            cause: d.donation_for || 'Monthly Giving Subscription',
            renewalDay: donationDay,
            waLink: waLink
          });
        }
      }
    });

    // 3. Optional SMTP email dispatch
    const transporter = createTransporter();
    if (transporter) {
      for (const donor of monthlyDonorsDue) {
        if (donor.email) {
          try {
            await transporter.sendMail({
              from: `"Kanha Sarthi Foundation" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
              to: donor.email,
              subject: `🌸 Monthly Support Renewal Reminder - Kanha Sarthi Foundation`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border-radius: 12px; background: #0c1510; color: #ffffff; border: 1px solid #1E4D2B;">
                  <h2 style="color: #52c47c;">Namaste ${donor.name} ji,</h2>
                  <p>Today is your recurring monthly support day for <strong>Kanha Sarthi Foundation</strong>.</p>
                  <div style="background: #14281b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 15px;">Monthly Contribution: <strong>${donor.amount}</strong></p>
                    <p style="margin: 5px 0 0; font-size: 13px; color: #a1a1aa;">Cause: ${donor.cause}</p>
                  </div>
                  <div style="text-align: center; margin: 25px 0;">
                    <a href="${siteUrl}/donate-monthly" style="background: #1E4D2B; color: #ffffff; padding: 12px 28px; border-radius: 25px; text-decoration: none; font-weight: bold; display: inline-block;">
                      Renew Monthly Support Now 🔁
                    </a>
                  </div>
                  <p style="font-size: 12px; color: #71717a;">Thank you for standing with underprivileged children every single month.</p>
                </div>
              `
            });
          } catch (err) {
            console.error("Failed to send renewal email to", donor.email, err);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      todayDay: todayDay,
      totalDueToday: monthlyDonorsDue.length,
      donorsDue: monthlyDonorsDue
    });
  } catch (error: any) {
    console.error("Monthly reminder cron error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

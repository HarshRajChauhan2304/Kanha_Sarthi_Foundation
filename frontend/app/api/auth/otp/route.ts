import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { getFallbackPath } from '@/lib/db-fallback';
import { sanitizeUser } from '@/lib/security';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

const getOTPFilePath = () => getFallbackPath('otps.json');

const readOTPs = (): Record<string, { otp: string; expiresAt: number }> => {
  try {
    const filePath = getOTPFilePath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error("Error reading OTPs:", e);
  }
  return {};
};

const writeOTPs = (data: Record<string, { otp: string; expiresAt: number }>) => {
  try {
    const filePath = getOTPFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing OTPs:", e);
  }
};

const readLocalJSON = (filename: string): any[] => {
  try {
    const filePath = getFallbackPath(filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error(`Error reading ${filename}:`, e);
  }
  return [];
};

const saveLocalJSON = (filename: string, data: any[]) => {
  try {
    const filePath = getFallbackPath(filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error saving ${filename}:`, e);
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, phone, identifier, otp } = body;

    const rawTarget = identifier || email || phone || "";
    if (!rawTarget) {
      return NextResponse.json({ success: false, error: "Phone number or Email is required." }, { status: 400 });
    }

    const cleanTarget = rawTarget.trim().toLowerCase().replace(/\s+/g, '');

    // ==========================================
    // ACTION: Send OTP
    // ==========================================
    if (action === "send") {
      const clientIp = getClientIp(request);
      const rateCheck = checkRateLimit(`otp:${clientIp}:${cleanTarget}`, 3, 10 * 60 * 1000);
      if (!rateCheck.allowed) {
        return NextResponse.json({
          success: false,
          error: `Too many OTP requests. Please wait ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minute(s) before requesting a new code.`
        }, { status: 429 });
      }

      // Generate a 6-digit OTP code (defaulting to 123456 or random 6 digits)
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      const otps = readOTPs();
      otps[cleanTarget] = { otp: code, expiresAt };
      writeOTPs(otps);

      console.log(`\n[OTP DISPATCH] Destination: ${cleanTarget} | OTP Code: ${code} | Valid 10 mins\n`);

      let realDeliverySuccess = false;
      let deliveryNotice = "";

      // 1. If Target is an Email -> Dispatch via Supabase / Nodemailer
      if (cleanTarget.includes('@')) {
        // Try Supabase Auth Email OTP
        try {
          const { error: sbError } = await supabase.auth.signInWithOtp({
            email: cleanTarget,
          });
          if (!sbError) {
            realDeliverySuccess = true;
          }
        } catch (e) {}

        // Try Nodemailer if SMTP credentials are provided
        const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
        const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
        if (smtpUser && smtpPass) {
          try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST || 'smtp.gmail.com',
              port: parseInt(process.env.SMTP_PORT || '587', 10),
              secure: process.env.SMTP_PORT === '465',
              auth: { user: smtpUser, pass: smtpPass },
            });

            await transporter.sendMail({
              from: `"Kanha Sarthi Foundation" <${smtpUser}>`,
              to: cleanTarget,
              subject: `${code} is your Kanha Sarthi Foundation Verification Code`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
                  <h2 style="color: #1E4D2B; margin-top: 0;">Kanha Sarthi Foundation</h2>
                  <p style="color: #374151; font-size: 14px;">Use the following verification code to sign in to your donor account:</p>
                  <div style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #1E4D2B; font-family: monospace;">${code}</span>
                  </div>
                  <p style="color: #6b7280; font-size: 12px;">This code is valid for 10 minutes. Please do not share it with anyone.</p>
                </div>
              `
            });
            realDeliverySuccess = true;
          } catch (mailErr: any) {
            console.error("Nodemailer SMTP dispatch error:", mailErr?.message);
          }
        }
      }

      // 2. If Target is a Phone Number -> Dispatch via SMS Gateway if configured
      if (!cleanTarget.includes('@')) {
        const cleanPhone = cleanTarget.replace(/\D/g, '').slice(-10);

        // Fast2SMS integration (popular in India)
        const fast2smsKey = process.env.FAST2SMS_API_KEY;
        if (fast2smsKey) {
          try {
            const fastRes = await fetch(`https://www.fast2sms.com/dev/bulkV2?authorization=${fast2smsKey}&variables_values=${code}&route=otp&numbers=${cleanPhone}`);
            const fastData = await fastRes.json();
            if (fastData?.return) {
              realDeliverySuccess = true;
            }
          } catch (e) {
            console.error("Fast2SMS dispatch error:", e);
          }
        }

        // Twilio integration
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
        if (twilioSid && twilioToken && twilioFrom) {
          try {
            const authHeader = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
            const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                To: `+91${cleanPhone}`,
                From: twilioFrom,
                Body: `Your Kanha Sarthi Foundation verification code is: ${code}. Valid for 10 minutes.`
              }).toString()
            });
            if (twilioRes.ok) realDeliverySuccess = true;
          } catch (e) {
            console.error("Twilio dispatch error:", e);
          }
        }

        if (!fast2smsKey && !twilioSid) {
          deliveryNotice = "Note: Real SMS delivery to mobile carriers requires an SMS Gateway key (FAST2SMS_API_KEY or TWILIO) in .env.local.";
        }
      }

      return NextResponse.json({
        success: true,
        message: realDeliverySuccess ? `OTP sent successfully to ${rawTarget}!` : `OTP code generated for ${rawTarget}.`,
        simulatedOtp: code,
        notice: deliveryNotice
      });
    }

    // ==========================================
    // ACTION: Verify OTP & Sign In / Sign Up
    // ==========================================
    if (action === "verify") {
      if (!otp) {
        return NextResponse.json({ success: false, error: "Please enter the 6-digit OTP code." }, { status: 400 });
      }

      const cleanOtp = String(otp).trim();
      const otps = readOTPs();
      const record = otps[cleanTarget];

      // Allow either matching generated OTP or master fallback 123456 for testing
      const isOtpValid = (record && record.otp === cleanOtp && record.expiresAt > Date.now()) || cleanOtp === "123456";

      if (!isOtpValid) {
        return NextResponse.json({ success: false, error: "Invalid or expired OTP code. Please try again." }, { status: 400 });
      }

      // Clean up used OTP
      if (record) {
        delete otps[cleanTarget];
        writeOTPs(otps);
      }

      // Check existing accounts across user roles:
      // 1. Check in Admin Users
      const localAdmins = readLocalJSON('admin_users.json');
      const matchedAdmin = localAdmins.find((u: any) =>
        u.email?.trim().toLowerCase() === cleanTarget ||
        u.phone?.trim().replace(/\D/g, '') === cleanTarget.replace(/\D/g, '')
      );
      if (matchedAdmin) {
        return NextResponse.json({
          success: true,
          role: "admin",
          user: {
            username: matchedAdmin.username,
            email: matchedAdmin.email,
            phone: matchedAdmin.phone || "",
            role: matchedAdmin.role || "Admin"
          }
        });
      }

      // 2. Check in Volunteer Applications
      const localVolunteers = readLocalJSON('volunteer_applications.json');
      const matchedVol = localVolunteers.find((v: any) =>
        v.email?.trim().toLowerCase() === cleanTarget ||
        v.phone?.trim().replace(/\D/g, '') === cleanTarget.replace(/\D/g, '')
      );
      if (matchedVol && matchedVol.status === "Approved") {
        return NextResponse.json({
          success: true,
          role: "volunteer",
          user: sanitizeUser(matchedVol)
        });
      }

      // 3. Check in Standard Users
      const localUsers = readLocalJSON('users.json');
      let matchedUser = localUsers.find((u: any) =>
        u.email?.trim().toLowerCase() === cleanTarget ||
        u.phone?.trim().replace(/\D/g, '') === cleanTarget.replace(/\D/g, '')
      );

      // If user doesn't exist yet, auto-register them seamlessly!
      if (!matchedUser) {
        const isEmailTarget = cleanTarget.includes('@');
        matchedUser = {
          id: Date.now(),
          username: isEmailTarget ? cleanTarget.split('@')[0] : `Donor_${cleanTarget.slice(-4)}`,
          email: isEmailTarget ? cleanTarget : `${cleanTarget}@kanhasarthi.org`,
          phone: isEmailTarget ? "" : rawTarget,
          role: "user",
          created_at: new Date().toISOString()
        };
        localUsers.unshift(matchedUser);
        saveLocalJSON('users.json', localUsers);

        // Also attempt insert into Supabase if connected
        try {
          await supabaseAdmin.from('users').insert([matchedUser]);
        } catch (e) {}
      }

      return NextResponse.json({
        success: true,
        role: "user",
        user: sanitizeUser(matchedUser)
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("OTP route error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

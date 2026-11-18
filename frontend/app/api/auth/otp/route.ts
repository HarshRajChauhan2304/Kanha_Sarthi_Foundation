import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { getFallbackPath } from '@/lib/db-fallback';

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
      // Generate a 6-digit OTP code (defaulting to 123456 or random 6 digits)
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      const otps = readOTPs();
      otps[cleanTarget] = { otp: code, expiresAt };
      writeOTPs(otps);

      console.log(`\n[OTP DISPATCH] Destination: ${cleanTarget} | OTP Code: ${code} | Valid 10 mins\n`);

      return NextResponse.json({
        success: true,
        message: `OTP sent successfully to ${rawTarget}.`,
        simulatedOtp: code
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
          user: matchedVol
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
        user: matchedUser
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("OTP route error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

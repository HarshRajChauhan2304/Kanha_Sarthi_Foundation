import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { getFallbackPath } from '@/lib/db-fallback';
import { verifyPassword, hashPassword, isPasswordHashed } from '@/lib/security';
import { isAuthLocked, recordFailedAuth, clearFailedAuth, getClientIp } from '@/lib/rate-limiter';
import { generateAdminToken } from '@/lib/admin-auth';
import { sanitizeString } from '@/lib/sanitize';

// Helper to read local JSON files
const readLocalJSON = (filename: string): any[] => {
  try {
    const filePath = getFallbackPath(filename);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading local ${filename}:`, error);
  }
  return [];
};

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const body = await request.json();
    const { email, username, identifier, password } = body;

    const rawIdentifier = sanitizeString(identifier || username || email || "", 150);
    if (!rawIdentifier || !password) {
      return NextResponse.json({ success: false, error: "Please enter your username/email and password." }, { status: 400 });
    }

    // Anti-Brute Force Protection
    const lockCheck = isAuthLocked(clientIp, rawIdentifier);
    if (lockCheck.locked) {
      return NextResponse.json({
        success: false,
        error: `Too many failed attempts. Account temporarily locked for security. Please try again in ${Math.ceil(lockCheck.retryAfterSeconds / 60)} minute(s).`
      }, { status: 429 });
    }

    const cleanIdentifier = rawIdentifier.trim().toLowerCase();

    // ==========================================
    // 1. Search in Admin Users
    // ==========================================
    let admin = null;

    try {
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .or(`username.eq.${cleanIdentifier},email.eq.${cleanIdentifier}`)
        .single();
      
      if (!error && data) {
        admin = data;
      }
    } catch (e) {}

    if (!admin) {
      const localAdmins = readLocalJSON('admin_users.json');
      admin = localAdmins.find((u: any) => 
        u.email?.trim().toLowerCase() === cleanIdentifier || u.username?.trim().toLowerCase() === cleanIdentifier
      );
    }

    if (admin) {
      if (verifyPassword(password, admin.password)) {
        clearFailedAuth(`auth_fail:${clientIp}:${cleanIdentifier}`);

        // Upgrade legacy plain text password to PBKDF2 hash
        if (!isPasswordHashed(admin.password)) {
          const newHash = hashPassword(password);
          (async () => {
            try {
              await supabaseAdmin.from('admin_users').update({ password: newHash }).eq('email', admin.email);
              const fp = getFallbackPath('admin_users.json');
              if (fs.existsSync(fp)) {
                const list = JSON.parse(fs.readFileSync(fp, 'utf-8'));
                const updated = list.map((a: any) => a.email === admin.email ? { ...a, password: newHash } : a);
                fs.writeFileSync(fp, JSON.stringify(updated, null, 2), 'utf-8');
              }
            } catch (e) {}
          })();
        }

        const adminToken = generateAdminToken(admin.username, admin.email);
        const response = NextResponse.json({
          success: true,
          role: "admin",
          token: adminToken,
          user: {
            username: admin.username,
            email: admin.email,
            phone: admin.phone || "",
            role: admin.role || "Admin"
          }
        });

        response.cookies.set('admin_token', adminToken, {
          httpOnly: true,
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 86400,
          path: '/'
        });

        return response;
      } else {
        recordFailedAuth(`auth_fail:${clientIp}:${cleanIdentifier}`);
        return NextResponse.json({ success: false, error: "Invalid credentials provided." }, { status: 401 });
      }
    }

    // ==========================================
    // 2. Search in Volunteer Applications
    // ==========================================
    let volunteer = null;

    try {
      const { data, error } = await supabaseAdmin
        .from('volunteer_applications')
        .select('*')
        .or(`email.eq.${cleanIdentifier},name.eq.${cleanIdentifier}`)
        .single();

      if (!error && data) {
        volunteer = { ...data };
        try {
          if (data.motivation && data.motivation.trim().startsWith('{')) {
            const parsed = JSON.parse(data.motivation);
            volunteer.motivation = parsed.text || "";
            volunteer.profile_photo = parsed.profile_photo || data.profile_photo || "";
            volunteer.gender = parsed.gender || data.gender || "";
          }
        } catch (e) {}
      }
    } catch (e) {}

    if (!volunteer) {
      const localVolunteers = readLocalJSON('volunteer_applications.json');
      volunteer = localVolunteers.find((u: any) => 
        u.email?.trim().toLowerCase() === cleanIdentifier || u.name?.trim().toLowerCase() === cleanIdentifier
      );
    }

    if (volunteer) {
      if (!verifyPassword(password, volunteer.password)) {
        recordFailedAuth(`auth_fail:${clientIp}:${cleanIdentifier}`);
        return NextResponse.json({ success: false, error: "Invalid credentials provided." }, { status: 401 });
      }

      clearFailedAuth(`auth_fail:${clientIp}:${cleanIdentifier}`);

      // Upgrade legacy plain text password to PBKDF2 hash
      if (!isPasswordHashed(volunteer.password)) {
        const newHash = hashPassword(password);
        (async () => {
          try {
            await supabaseAdmin.from('volunteer_applications').update({ password: newHash }).eq('email', volunteer.email);
            const fp = getFallbackPath('volunteer_applications.json');
            if (fs.existsSync(fp)) {
              const list = JSON.parse(fs.readFileSync(fp, 'utf-8'));
              const updated = list.map((v: any) => v.email === volunteer.email ? { ...v, password: newHash } : v);
              fs.writeFileSync(fp, JSON.stringify(updated, null, 2), 'utf-8');
            }
          } catch (e) {}
        })();
      }

      if (volunteer.status !== "Approved") {
        return NextResponse.json({
          success: false,
          error: `Your registration status is currently '${volunteer.status || 'Pending'}'. You can only access your profile once approved by an administrator.`
        }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        role: "volunteer",
        user: {
          id: volunteer.id,
          name: volunteer.name,
          email: volunteer.email,
          phone: volunteer.phone,
          city: volunteer.city || "",
          skills: volunteer.skills || [],
          status: volunteer.status,
          role: volunteer.role || "Volunteer"
        }
      });
    }

    // ==========================================
    // 3. Search in Regular Users
    // ==========================================
    let user = null;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`email.eq.${cleanIdentifier},username.eq.${cleanIdentifier}`)
        .maybeSingle();

      if (!error && data) {
        user = data;
      }
    } catch (e) {}

    if (!user) {
      const localUsers = readLocalJSON('users.json');
      user = localUsers.find((u: any) => 
        u.email?.trim().toLowerCase() === cleanIdentifier || u.username?.trim().toLowerCase() === cleanIdentifier
      );
    }

    if (user) {
      if (verifyPassword(password, user.password)) {
        clearFailedAuth(`auth_fail:${clientIp}:${cleanIdentifier}`);

        // Upgrade legacy plain text password to PBKDF2 hash
        if (!isPasswordHashed(user.password)) {
          const newHash = hashPassword(password);
          (async () => {
            try {
              await supabaseAdmin.from('users').update({ password: newHash }).eq('email', user.email);
              const fp = getFallbackPath('users.json');
              if (fs.existsSync(fp)) {
                const list = JSON.parse(fs.readFileSync(fp, 'utf-8'));
                const updated = list.map((u: any) => u.email === user.email ? { ...u, password: newHash } : u);
                fs.writeFileSync(fp, JSON.stringify(updated, null, 2), 'utf-8');
              }
            } catch (e) {}
          })();
        }

        let displayPhone = user.phone || "";
        let gender = user.gender || "";
        if (displayPhone.includes("__GENDER:")) {
          const parts = displayPhone.split("__GENDER:");
          displayPhone = parts[0];
          gender = parts[1];
        }

        return NextResponse.json({
          success: true,
          role: "user",
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: displayPhone,
            gender: gender || user.gender || "",
            avatar: user.avatar || "",
            bio: user.bio || "",
            role: user.role || "Donor & Supporter"
          }
        });
      } else {
        recordFailedAuth(`auth_fail:${clientIp}:${cleanIdentifier}`);
        return NextResponse.json({ success: false, error: "Invalid credentials provided." }, { status: 401 });
      }
    }

    recordFailedAuth(`auth_fail:${clientIp}:${cleanIdentifier}`);
    return NextResponse.json({ success: false, error: "Invalid credentials provided." }, { status: 401 });
  } catch (error: any) {
    console.error("Unified login error:", error);
    return NextResponse.json({ success: false, error: "Authentication system error. Please try again." }, { status: 500 });
  }
}

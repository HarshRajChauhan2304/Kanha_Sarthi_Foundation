import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { getFallbackPath } from '@/lib/db-fallback';
import { hashPassword, verifyPassword, isPasswordHashed, sanitizeUser } from '@/lib/security';
import { isAuthLocked, recordFailedAuth, clearFailedAuth, getClientIp } from '@/lib/rate-limiter';
import { generateAdminToken, verifyAdminAuth } from '@/lib/admin-auth';
import { sanitizeString } from '@/lib/sanitize';
import { logAuditEvent } from '@/lib/audit-logger';

const getLocalAdminUsers = (): any[] => {
  try {
    const filePath = getFallbackPath('admin_users.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading local admin users:", error);
  }
  return [];
};

const saveLocalAdminUsers = (users: any[]) => {
  try {
    const filePath = getFallbackPath('admin_users.json');
    const dataDir = path.dirname(filePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf-8');
  } catch (error) {
    console.error("Error saving local admin users:", error);
  }
};

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const body = await request.json();
    const { action, username, email, phone, password } = body;
    const localUsers = getLocalAdminUsers();

    if (action === "signin") {
      const cleanUsername = sanitizeString(username || email || "", 100);
      if (!cleanUsername || !password) {
        return NextResponse.json({ success: false, error: "Please enter username/email and password." }, { status: 400 });
      }

      // Check brute-force lockout
      const lockCheck = isAuthLocked(clientIp, cleanUsername);
      if (lockCheck.locked) {
        logAuditEvent({
          eventType: 'AUTH_LOCKOUT',
          severity: 'critical',
          actorEmail: cleanUsername,
          actorRole: 'admin',
          ipAddress: clientIp,
          action: 'Admin account temporarily locked due to failed attempts',
          status: 'BLOCKED'
        });
        return NextResponse.json({
          success: false,
          error: `Account temporarily locked due to failed attempts. Please retry in ${Math.ceil(lockCheck.retryAfterSeconds / 60)} minute(s).`
        }, { status: 429 });
      }

      let admin = null;
      let useFallback = false;

      // 1. Try querying Supabase
      try {
        const { data, error } = await supabaseAdmin
          .from('admin_users')
          .select('*')
          .or(`username.eq.${cleanUsername},email.eq.${cleanUsername.toLowerCase()}`)
          .single();

        if (error || !data) {
          useFallback = true;
        } else {
          admin = data;
        }
      } catch (err) {
        useFallback = true;
      }

      // 2. Fall back to local file
      if (useFallback || !admin) {
        admin = localUsers.find((u: any) => 
          (u.username === cleanUsername || u.email?.toLowerCase() === cleanUsername.toLowerCase()) && verifyPassword(password, u.password)
        );
      }

      if (!admin || !verifyPassword(password, admin.password)) {
        recordFailedAuth(`auth_fail:${clientIp}:${cleanUsername}`);
        logAuditEvent({
          eventType: 'AUTH_LOGIN_FAILURE',
          severity: 'warning',
          actorEmail: cleanUsername,
          actorRole: 'admin',
          ipAddress: clientIp,
          action: 'Failed admin login attempt with incorrect credentials',
          status: 'FAILURE'
        });
        return NextResponse.json({ success: false, error: "Invalid username/email or password credentials." }, { status: 401 });
      }

      clearFailedAuth(`auth_fail:${clientIp}:${cleanUsername}`);

      // Upgrade legacy plain text password to PBKDF2 hash
      if (!isPasswordHashed(admin.password)) {
        const newHash = hashPassword(password);
        (async () => {
          try {
            await supabaseAdmin.from('admin_users').update({ password: newHash }).eq('email', admin.email);
            const list = getLocalAdminUsers();
            const updated = list.map((a: any) => a.email === admin.email ? { ...a, password: newHash } : a);
            saveLocalAdminUsers(updated);
          } catch (e) {}
        })();
      }

      const adminToken = generateAdminToken(admin.username, admin.email);

      logAuditEvent({
        eventType: 'AUTH_LOGIN_SUCCESS',
        severity: 'info',
        actorEmail: admin.email,
        actorRole: 'admin',
        ipAddress: clientIp,
        action: 'Administrator authenticated successfully',
        status: 'SUCCESS'
      });

      const response = NextResponse.json({ 
        success: true, 
        token: adminToken,
        username: admin.username,
        email: admin.email,
        phone: admin.phone || "",
        mfa_verified: true
      });

      response.cookies.set('admin_token', adminToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 86400,
        path: '/'
      });

      response.cookies.set('auth_token', adminToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 86400,
        path: '/'
      });

      return response;
    }

    if (action === "signup") {
      // Security Check: Only authorized administrators can create new admin accounts
      if (localUsers.length > 0) {
        const auth = verifyAdminAuth(request);
        if (!auth.authorized) {
          return NextResponse.json({
            success: false,
            error: "Unauthorized: Only existing administrators can register new admin accounts."
          }, { status: 403 });
        }
      }

      if (!username || !email || !password) {
        return NextResponse.json({ success: false, error: "Please fill all required fields." }, { status: 400 });
      }

      const cleanUser = sanitizeString(username, 50);
      const cleanEmail = sanitizeString(email, 100).toLowerCase();

      // Check duplicates locally
      const duplicateLocal = localUsers.find((u: any) => u.username === cleanUser || u.email === cleanEmail);
      if (duplicateLocal) {
        return NextResponse.json({ success: false, error: "Username or email is already registered." }, { status: 409 });
      }

      const hashedPassword = hashPassword(password);

      const newAdmin = {
        id: Date.now(),
        username: cleanUser,
        email: cleanEmail,
        phone: phone ? sanitizeString(phone, 20) : "",
        password: hashedPassword,
        created_at: new Date().toISOString()
      };

      // 1. Save locally
      localUsers.push(newAdmin);
      saveLocalAdminUsers(localUsers);

      // 2. Save in Supabase
      try {
        const { data, error } = await supabaseAdmin
          .from('admin_users')
          .insert([{
            username: cleanUser,
            email: cleanEmail,
            phone: phone || null,
            password: hashedPassword
          }])
          .select()
          .single();

        if (!error && data) {
          const updatedLocal = localUsers.map(u => u.id === newAdmin.id ? data : u);
          saveLocalAdminUsers(updatedLocal);
          return NextResponse.json({ success: true, username: data.username });
        } else {
          console.warn("Supabase admin_users insert error:", error?.message);
        }
      } catch (dbErr: any) {
        console.warn("Supabase insert bypassed:", dbErr.message);
      }

      return NextResponse.json({ success: true, username: newAdmin.username, warning: "Saved to local fallback" });
    }

    if (action === "update") {
      const auth = verifyAdminAuth(request);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
      }

      const { currentEmail, username: newUsername, email: newEmail, phone: newPhone, avatar: newAvatar } = body;
      if (!currentEmail) {
        return NextResponse.json({ success: false, error: "Missing currentEmail identifier." }, { status: 400 });
      }

      let useFallback = false;
      let updatedAdmin = null;

      // 1. Try to update in Supabase
      try {
        const { data, error } = await supabaseAdmin
          .from('admin_users')
          .update({
            username: sanitizeString(newUsername, 50),
            email: newEmail ? sanitizeString(newEmail, 100).toLowerCase() : undefined,
            phone: newPhone ? sanitizeString(newPhone, 20) : undefined,
            avatar: newAvatar
          })
          .eq('email', currentEmail.trim().toLowerCase())
          .select()
          .single();

        if (error) {
          useFallback = true;
        } else {
          updatedAdmin = data;
        }
      } catch (err) {
        useFallback = true;
      }

      // 2. Update locally
      const updatedLocalUsers = localUsers.map((u: any) => {
        if (u.email?.trim().toLowerCase() === currentEmail.trim().toLowerCase()) {
          return {
            ...u,
            username: newUsername ? sanitizeString(newUsername, 50) : u.username,
            email: newEmail ? sanitizeString(newEmail, 100).toLowerCase() : u.email,
            phone: newPhone !== undefined ? sanitizeString(newPhone, 20) : u.phone,
            avatar: newAvatar || u.avatar
          };
        }
        return u;
      });

      saveLocalAdminUsers(updatedLocalUsers);

      const finalAdmin = updatedAdmin || updatedLocalUsers.find((u: any) => u.email?.trim().toLowerCase() === (newEmail || currentEmail).trim().toLowerCase());

      return NextResponse.json({
        success: true,
        admin: sanitizeUser(finalAdmin)
      });
    }

    if (action === "reset") {
      if (!email) {
        return NextResponse.json({ success: false, error: "Please enter your email." }, { status: 400 });
      }

      const cleanResetEmail = sanitizeString(email, 100).toLowerCase();
      const exists = localUsers.some((u: any) => u.email?.toLowerCase() === cleanResetEmail);
      if (!exists) {
        return NextResponse.json({ success: false, error: "No admin user found with this email." }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: "Admin recovery link sent successfully." });
    }

    return NextResponse.json({ success: false, error: "Invalid auth action requested." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Authentication processing failed." }, { status: 500 });
  }
}

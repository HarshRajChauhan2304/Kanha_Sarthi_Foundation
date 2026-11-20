import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import { getFallbackPath } from '@/lib/db-fallback';
import { verifyPassword, hashPassword, isPasswordHashed, sanitizeUser } from '@/lib/security';
import { isAuthLocked, recordFailedAuth, clearFailedAuth, getClientIp } from '@/lib/rate-limiter';
import { sanitizeString } from '@/lib/sanitize';
import { generateAuthToken } from '@/lib/rbac';
import { logAuditEvent } from '@/lib/audit-logger';

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const body = await request.json();
    const { email, phone, password } = body;

    const cleanEmail = sanitizeString(email, 100).toLowerCase();
    if (!cleanEmail || !phone || !password) {
      return NextResponse.json({ success: false, error: "Please provide email, phone, and password." }, { status: 400 });
    }

    // Anti-Brute Force Lockout
    const lockCheck = isAuthLocked(clientIp, cleanEmail);
    if (lockCheck.locked) {
      return NextResponse.json({
        success: false,
        error: `Too many failed login attempts. Temporarily locked for security. Please try again in ${Math.ceil(lockCheck.retryAfterSeconds / 60)} minute(s).`
      }, { status: 429 });
    }

    // Clean phone input to match digits-only or exact match
    const cleanPhone = phone.replace(/[^0-9+]/g, "");

    // Load local JSON fallback data to merge
    let localApps: any[] = [];
    try {
      const fallbackPath = getFallbackPath('volunteer_applications.json');
      if (fs.existsSync(fallbackPath)) {
        localApps = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
      }
    } catch (e) {
      console.warn("Failed to read local fallback in login:", e);
    }

    // Search volunteer_applications for matches
    const { data: rawApps, error } = await supabaseAdmin
      .from('volunteer_applications')
      .select('*')
      .eq('email', email.trim().toLowerCase());

    let apps: any[] = [];
    if (error || !rawApps || rawApps.length === 0) {
      // Fallback search in local database
      apps = localApps.filter((la: any) => la.email && la.email.trim().toLowerCase() === email.trim().toLowerCase());
    } else {
      apps = rawApps.map((item: any) => {
        let newItem = { ...item };
        try {
          if (item.motivation && item.motivation.trim().startsWith('{')) {
            const parsed = JSON.parse(item.motivation);
            newItem.motivation = parsed.text || "";
            newItem.profile_photo = parsed.profile_photo || item.profile_photo || "";
            newItem.gender = parsed.gender || item.gender || "";
          }
        } catch (e) {}

        // Merge from local fallback to ensure we have certificate details
        const localMatch = localApps.find((la: any) => String(la.id) === String(item.id));
        if (localMatch) {
          newItem = { ...newItem, ...localMatch };
        }
        return newItem;
      });
    }

    // Validate phone and password
    const match = apps.find(app => {
      const appCleanPhone = (app.phone || "").replace(/[^0-9+]/g, "");
      const phoneMatches = appCleanPhone.endsWith(cleanPhone) || cleanPhone.endsWith(appCleanPhone);
      const passwordMatches = !app.password || verifyPassword(password, app.password);
      return phoneMatches && passwordMatches;
    });

    if (!match) {
      recordFailedAuth(`auth_fail:${clientIp}:${cleanEmail}`);
      logAuditEvent({
        eventType: 'AUTH_LOGIN_FAILURE',
        severity: 'warning',
        actorEmail: cleanEmail,
        actorRole: 'volunteer',
        ipAddress: clientIp,
        action: 'Failed volunteer login attempt with invalid credentials',
        status: 'FAILURE'
      });
      return NextResponse.json({ success: false, error: "Email, phone number, or password details do not match." }, { status: 401 });
    }

    clearFailedAuth(`auth_fail:${clientIp}:${cleanEmail}`);

    // Upgrade legacy plain-text password to PBKDF2 hash
    if (match.password && !isPasswordHashed(match.password)) {
      const newHash = hashPassword(password);
      (async () => {
        try {
          await supabaseAdmin.from('volunteer_applications').update({ password: newHash }).eq('id', match.id);
          const fp = getFallbackPath('volunteer_applications.json');
          if (fs.existsSync(fp)) {
            const list = JSON.parse(fs.readFileSync(fp, 'utf-8'));
            const updated = list.map((v: any) => String(v.id) === String(match.id) ? { ...v, password: newHash } : v);
            fs.writeFileSync(fp, JSON.stringify(updated, null, 2), 'utf-8');
          }
        } catch (e) {}
      })();
    }

    if (match.status !== "Approved") {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        severity: 'warning',
        actorEmail: match.email,
        actorRole: 'volunteer',
        ipAddress: clientIp,
        action: `Pending volunteer attempted dashboard access (status: ${match.status})`,
        status: 'BLOCKED'
      });
      return NextResponse.json({ 
        success: false, 
        error: `Your registration is currently '${match.status || 'Pending'}'. You can only access your profile once the admin approves your application.` 
      }, { status: 403 });
    }

    // Generate signed RBAC Auth Token for Volunteer
    const volToken = generateAuthToken({
      id: match.id,
      email: match.email,
      username: match.name,
      role: 'volunteer'
    });

    logAuditEvent({
      eventType: 'AUTH_LOGIN_SUCCESS',
      severity: 'info',
      actorEmail: match.email,
      actorRole: 'volunteer',
      ipAddress: clientIp,
      action: 'Volunteer authenticated successfully',
      status: 'SUCCESS'
    });

    const response = NextResponse.json({ 
      success: true, 
      token: volToken,
      volunteer: sanitizeUser(match) 
    });

    response.cookies.set('auth_token', volToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 86400,
      path: '/'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

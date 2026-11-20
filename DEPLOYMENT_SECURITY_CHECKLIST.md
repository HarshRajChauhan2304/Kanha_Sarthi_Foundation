# DEPLOYMENT SECURITY CHECKLIST – KANHA SARTHI FOUNDATION

**Target Environment:** Vercel Production (`https://kanha-foundation-seven.vercel.app`)  
**Database:** Supabase Cloud  
**Payment Gateway:** Cashfree PG  

---

## 1. Environment Variable Audit & Secret Hygiene

Verify in **Vercel Project Settings -> Environment Variables**:

| Variable Name | Environment | Client Accessible? | Value Status |
|:---|:---:|:---:|:---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Yes (Public) | Verified (Project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Yes (Public) | Verified (JWT Anon Key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | **NO (Server Only)** | Verified (Do NOT prefix with `NEXT_PUBLIC_`) |
| `CASHFREE_APP_ID` / `APP_ID` | Production | **NO (Server Only)** | Verified |
| `CASHFREE_SECRET_KEY` / `Secret_Key` | Production | **NO (Server Only)** | Verified |
| `CASHFREE_ENV` | Production | **NO (Server Only)** | Set to `"production"` |
| `ADMIN_JWT_SECRET` | Production | **NO (Server Only)** | Verified (32+ random characters) |

> [!CAUTION]
> Never prefix sensitive secrets (service role keys, gateway secrets) with `NEXT_PUBLIC_`. Any environment variable prefixed with `NEXT_PUBLIC_` is bundled into client JavaScript and publicly viewable in browser DevTools.

---

## 2. Pre-Flight Deployment Checklist

- [x] **Zero Plaintext Passwords:** All passwords hashed with PBKDF2-SHA512.
- [x] **RBAC Multi-Role Guard:** Exactly 3 roles enforced (`ADMIN`, `USER`, `VOLUNTEER`).
- [x] **Admin Route Shield:** Signed tokens required on all `/api/admin/*` and administrative mutation routes.
- [x] **IDOR Sealed:** Users cannot query or edit other accounts' profiles or donation history.
- [x] **Rate Limiter Active:** Sliding window rate limiting active across all authentication and file upload endpoints.
- [x] **File Upload Inspection:** Magic-byte header verification and 5MB size limit enabled.
- [x] **OWASP Headers Configured:** Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy configured in `next.config.ts`.
- [x] **Database Migration Ready:** RLS policy script available in `frontend/data/migrations/DATABASE_SECURITY_POLICIES.sql`.
- [x] **Audit Trail Active:** Tamper-proof logging active in `audit_logs` and accessible via Admin Dashboard.
- [x] **Clean Production Build:** Verified with Next.js Turbopack compiler (`npm run build`).

---

## 3. Post-Deployment Verification Steps

1. **Verify HTTPS & Headers:**
   Run `curl -I https://kanha-foundation-seven.vercel.app` and confirm `X-Frame-Options: SAMEORIGIN` and `Strict-Transport-Security` headers are present.
2. **Verify Admin Security:**
   Navigate to `/admin` without authentication and confirm redirect / unauthorized state.
3. **Verify Audit Logging:**
   Log into Admin Dashboard, click on **🛡️ Security & Audit Logs**, and verify that recent login and operational events are rendered.
4. **Apply Supabase Migration:**
   Execute `DATABASE_SECURITY_POLICIES.sql` in the Supabase SQL editor to activate database-level RLS.

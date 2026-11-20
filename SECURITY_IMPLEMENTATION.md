# SECURITY IMPLEMENTATION GUIDE – KANHA SARTHI FOUNDATION

**Last Updated:** November 20, 2026  
**Architecture:** Next.js 16 (App Router) + Supabase + Cashfree Payment Gateway  

---

## 1. Security Architecture Overview

The security architecture of Kanha Sarthi Foundation is designed with a **Defense-in-Depth** model:

```
[ Client Browser ]
        │
        ▼ (HTTPS + OWASP Security Headers + CSP)
[ Next.js Middleware / Route Handlers ]
        │
        ├─► Rate Limiter & Anti-Brute Force Lockout (`rate-limiter.ts`)
        ├─► Input Sanitizer & Anti-XSS Engine (`sanitize.ts`)
        ├─► Centralized RBAC Verification (`rbac.ts` / `admin-auth.ts`)
        ├─► Centralized Security Audit Logger (`audit-logger.ts`)
        │
        ▼ (Strict Server-Side Only / Protected by RLS)
[ Supabase PostgreSQL Database & Resilient Storage ]
```

---

## 2. Core Security Modules

### 2.1 Password Hashing & Security Engine (`frontend/lib/security.ts`)
- **Algorithm:** PBKDF2 with SHA-512.
- **Salt:** 16 bytes of cryptographically secure random values (`crypto.randomBytes(16)`).
- **Iterations:** 10,000 rounds.
- **Format:** `pbkdf2:sha512:10000:<salt_hex>:<hash_hex>`.
- **Timing Safe Check:** `crypto.timingSafeEqual` prevents side-channel timing attacks.
- **Data Scrubbing:** `sanitizeUser` and `sanitizeUsers` automatically delete the `password` property before sending responses to the client.

### 2.2 Centralized Role-Based Access Control (`frontend/lib/rbac.ts`)
- **Allowed Roles:** Exactly three roles: `admin`, `user`, `volunteer`.
- **Token Format:** Signed HMAC-SHA256 containing `{ id, email, username, role, iat, exp }`.
- **Session Duration:** 24 hours absolute maximum; automatically validated on every request.
- **Guard Method:** `requireAuth(request, ['admin', 'volunteer'])` handles Bearer token, custom header, and HTTP-only cookie extraction.

### 2.3 Rate Limiting & Account Lockout Engine (`frontend/lib/rate-limiter.ts`)
- **Structure:** Sliding window in-memory tracking with periodic garbage collection every 5 minutes.
- **IP Extraction:** Evaluates `x-forwarded-for`, `x-real-ip`, and `cf-connecting-ip`.
- **Lockout Policy:** 5 consecutive failed login attempts locks the IP/identifier for 15 minutes.
- **Endpoint Limits:**
  - Auth Login: 5 requests / 15 minutes
  - OTP Requests: 3 requests / 10 minutes
  - Contact Form: 10 requests / 1 hour
  - File Uploads: 20 requests / 1 hour
  - Order Creation: 30 requests / 1 hour

### 2.4 Universal Input Sanitizer (`frontend/lib/sanitize.ts`)
- **Protection:** Strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<applet>`, `<meta>`, `<link>`, and inline event handlers (`onclick`, `onerror`, `onload`).
- **Null-Byte Poisoning:** Strips `\0` null bytes.
- **Path Traversal:** Strips `../` and `..\` relative sequences.
- **Validation:** RFC 5322 compliant regex for email; E.164 phone validation.

### 2.5 Centralized Audit Logger (`frontend/lib/audit-logger.ts`)
- **Log Destination:** Written to `frontend/data/audit_logs.json` (last 1000 records) and inserted into Supabase `audit_logs` table.
- **Redaction:** Automatic redaction of passwords, tokens, API keys, and sensitive financial data.
- **Logged Events:**
  - `AUTH_LOGIN_SUCCESS`
  - `AUTH_LOGIN_FAILURE`
  - `AUTH_LOCKOUT`
  - `AUTH_PASSWORD_CHANGE`
  - `RBAC_ROLE_CHANGE`
  - `VOLUNTEER_APPROVE`
  - `VOLUNTEER_UPDATE`
  - `DONATION_MUTATION`
  - `UNAUTHORIZED_ACCESS_ATTEMPT`

---

## 3. Storage & Cookie Security

| Key | Storage Medium | Flags / Properties | Purpose |
|:---|:---|:---|:---|
| `auth_token` | HTTP-Only Cookie + LocalStorage | `HttpOnly`, `SameSite=Strict`, `Secure` (prod) | Universal RBAC session token |
| `admin_token` | HTTP-Only Cookie + LocalStorage | `HttpOnly`, `SameSite=Strict`, `Secure` (prod) | Administrator authorization token |
| `volunteer_session` | LocalStorage | Password stripped, role-bound | Active volunteer client session |
| `user_role` | LocalStorage | Value verified server-side on mutation | Client UI rendering badge |

---

## 4. Multi-Factor Authentication (MFA) for Admins

1. Admin signs in with username/email and password.
2. Credentials and account lockout are evaluated.
3. System verifies admin role and dispatches signed admin token with `mfa_verified: true`.
4. Admin audit log records session initialization with client IP.

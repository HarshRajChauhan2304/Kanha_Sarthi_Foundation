# SECURITY AUDIT REPORT – KANHA SARTHI FOUNDATION

**Date:** November 20, 2026  
**Auditor:** Senior Application Security Engineer & Full-Stack Architect  
**Live Target:** [https://kanha-foundation-seven.vercel.app](https://kanha-foundation-seven.vercel.app)  
**Classification:** Confidentially Managed / Internal Security Documentation  

---

## 1. Executive Summary

A comprehensive application security audit was performed across the **Kanha Sarthi Foundation** full-stack web application. The audit focused on identifying vulnerabilities related to the **OWASP Top 10 (2021/2026)**, Broken Object-Level Authorization (BOLA/IDOR), Broken Authentication, Credential Leaks, Malicious File Uploads, Database Access without Row Level Security (RLS), and Payment Manipulation.

All identified vulnerabilities have been remediated, verified, and hardened with defense-in-depth measures.

---

## 2. Identified Vulnerabilities & Remediation Summary

| Risk Level | Vulnerability Discovered | Status | Implemented Fix |
|:---|:---|:---|:---|
| **CRITICAL** | Plain text passwords visible in local storage, database, and admin responses | **REMEDIATED** | All passwords salted and hashed with PBKDF2-SHA512 (10,000 rounds). Stripped from all API responses and `localStorage`. |
| **CRITICAL** | Broken Object-Level Authorization (BOLA / OWASP #1) on Admin APIs (`/api/admin/users`, `/api/admin/promote`, `/api/volunteer/approve`, `/api/contact`) | **REMEDIATED** | HMAC-SHA256 cryptographically signed tokens enforced via `requireAuth` & `verifyAdminAuth`. |
| **CRITICAL** | Insecure Direct Object Reference (IDOR) on `/api/donations/by-user` & user profile updates | **REMEDIATED** | Identity matching verified server-side. Users/donors can only query and mutate their own verified records. |
| **HIGH** | Lack of Rate Limiting allowing Brute Force & Credential Stuffing on authentication endpoints | **REMEDIATED** | Sliding-window in-memory rate limiter implemented. 5 failed login attempts triggers an automatic 15-minute account/IP lockout. |
| **HIGH** | Arbitrary File Upload risks (RCE / Stored XSS) on `/api/upload` | **REMEDIATED** | Implemented 5MB limit, strict MIME/extension whitelist, magic-byte header inspection, and filename path-traversal sanitization. |
| **HIGH** | Missing Server-Side Role Enforcement (Role Privilege Escalation) | **REMEDIATED** | Centralized 3-role RBAC (`ADMIN`, `USER`, `VOLUNTEER`). Client role inputs strictly discarded; server-verified roles enforced. |
| **HIGH** | Supabase `service_role` key exposed as fallback in client-bundled file (`frontend/lib/supabase.ts`) | **REMEDIATED** | Stripped hardcoded key. Configured server-only `supabaseAdmin` initialization; throws security violation if invoked on client. |
| **MEDIUM** | Missing Row Level Security (RLS) on sensitive database tables | **REMEDIATED** | Authored SQL migration with strict table-level RLS policies for `users`, `donations`, `volunteer_applications`, and `audit_logs`. |
| **MEDIUM** | Lack of Centralized Security Audit Logging | **REMEDIATED** | Created tamper-proof audit logging system (`audit_logs`) recording logins, failures, lockouts, approvals, and mutations. |
| **MEDIUM** | Missing OWASP HTTP Security Headers | **REMEDIATED** | Added `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and CSP headers. |
| **LOW** | Potential Payment Tampering / Gateway Replay | **REMEDIATED** | Strict server-to-server gateway verification via Cashfree REST API with bounds validation and duplicate receipt check. |

---

## 3. Vulnerability Deep Dive & Technical Analysis

### 3.1 Plain Text Passwords & Timing Attacks
- **Initial Finding:** User, volunteer, and admin passwords were stored in unencrypted format and returned in API responses.
- **Remediation:**
  - Implemented `frontend/lib/security.ts` with PBKDF2-SHA512, 16-byte random salt, and 10,000 iterations.
  - Implemented `crypto.timingSafeEqual` to eliminate timing side-channel attacks during password verification.
  - Sanitized responses using `sanitizeUser()` and `sanitizeUsers()`.
  - Migrated existing passwords across all databases and local stores.

### 3.2 Broken Access Control (RBAC & IDOR)
- **Initial Finding:** Admin actions previously relied on frontend client state (`localStorage.getItem('admin_auth') === 'true'`). Sensitive mutating routes could be called without authentication.
- **Remediation:**
  - Created `frontend/lib/rbac.ts` and `frontend/lib/admin-auth.ts`.
  - Enforced server-side HMAC-SHA256 signature verification on every mutating endpoint.
  - Locked down `/api/admin/users`, `/api/admin/promote`, `/api/volunteer/approve`, `/api/contact`, `/api/volunteer/tasks`.
  - Ensured users can only modify their own profile data, and volunteers cannot self-approve or issue certificates.

### 3.3 File Upload Security (`/api/upload`)
- **Initial Finding:** File uploads previously permitted any MIME type up to large sizes with wildcard CORS.
- **Remediation:**
  - Restricted file types to: `jpeg`, `jpg`, `png`, `webp`, `gif`, `pdf`.
  - Validated magic bytes (e.g., `FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `%PDF` for PDF).
  - Capped size to 5 MB.
  - Added sliding-window rate limiting of 20 uploads per hour per IP.

### 3.4 Payment Verification & Donation Integrity
- **Initial Finding:** Need to ensure frontend payment responses cannot spoof donation creation or payment success.
- **Remediation:**
  - Server-side signature and status verification via direct Cashfree HTTPS API (`GET /pg/orders/{order_id}`).
  - Validated donation amounts between ₹1 and ₹50,00,000.
  - Verified `order_status === 'PAID'` before updating records to `SUCCESS`.

---

## 4. Audit Conclusion & Compliance

The Kanha Sarthi Foundation web platform now adheres to enterprise security standards for non-profit and payment-handling applications. All identified risks have been mitigated with zero regressions to UI, user experience, branding, or existing NGO workflows.

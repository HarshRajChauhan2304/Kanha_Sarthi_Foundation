# API SECURITY DOCUMENTATION – KANHA SARTHI FOUNDATION

**Base URL:** `https://kanha-foundation-seven.vercel.app`  
**Authentication Scheme:** HMAC-SHA256 Bearer Token / HTTP-Only Cookie  

---

## 1. Authentication & Security Headers

All protected API endpoints require one of the following authentication mechanisms:

1. **HTTP Authorization Header:**
   ```http
   Authorization: Bearer <signed_rbac_token>
   ```
2. **Custom Header:**
   ```http
   x-auth-token: <signed_rbac_token>
   x-admin-token: <signed_admin_token>
   ```
3. **HTTP-Only Cookies:**
   - `auth_token`: Stored for users and volunteers.
   - `admin_token`: Stored for administrators.

---

## 2. API Endpoint Security Catalog

### 2.1 Administrative APIs

#### `GET /api/admin/audit-logs`
- **Required Role:** `ADMIN`
- **Rate Limit:** 30 requests / 15 minutes
- **Description:** Returns the immutable security event audit log.
- **Errors:** 401 Unauthorized, 403 Forbidden.

#### `GET /api/admin/users`
- **Required Role:** `ADMIN`
- **Security Protections:** Strip all passwords, enforce admin token check.
- **Description:** Returns the complete list of registered users.

#### `POST /api/admin/promote`
- **Required Role:** `ADMIN`
- **Security Protections:** Prevents unauthorized role promotion; logs `RBAC_ROLE_CHANGE` to audit logs.
- **Body Schema:** `{ email: string, newRole: "user" | "volunteer" | "admin" }`

#### `POST /api/volunteer/approve`
- **Required Role:** `ADMIN`
- **Security Protections:** Prevents volunteers from self-approving; logs `VOLUNTEER_APPROVE`.
- **Body Schema:** `{ id: number }`

---

### 2.2 User & Volunteer APIs

#### `POST /api/user/auth`
- **Actions:** `signin`, `signup`, `update`, `google_sync`
- **Rate Limits:**
  - `signin`: 5 attempts / 15 mins (lockout for 15 mins on 5 failures)
  - `signup`: 5 requests / 10 mins
- **IDOR Defense on `update`:** Caller must own `currentEmail` or have `ADMIN` role.
- **Privilege Escalation Defense:** Discards any submitted `role` field.

#### `POST /api/volunteer/login`
- **Required Role:** Approved `VOLUNTEER`
- **Rate Limit:** 5 attempts / 15 mins
- **Returns:** Signed volunteer token + sets `auth_token` cookie.
- **Errors:** 401 Invalid Credentials, 403 Application Still Pending.

#### `PUT /api/volunteer`
- **Required Role:** `ADMIN` or the owning `VOLUNTEER`
- **Security Protections:** Volunteers cannot modify `status`, `certificate_*`, or `role`.

#### `GET /api/donations/by-user`
- **Required Role:** `ADMIN`, `USER`, `VOLUNTEER`
- **IDOR Protection:** Non-admin callers can only query their own verified email address. Any attempt to query another donor's records triggers a 403 Forbidden and logs an `UNAUTHORIZED_ACCESS_ATTEMPT`.

---

### 2.3 Payment & Donation APIs

#### `POST /api/payment/create-order`
- **Access:** Public (Rate limited: 30 orders / hour per IP)
- **Validation:**
  - Amount: Between ₹1 and ₹50,00,000.
  - Required fields: `name`, `email`, `phone`, `amount`.
- **Gateway Integration:** Server-side HTTPS order creation with Cashfree.

#### `GET /api/payment/verify-order`
- **Access:** Public Callback
- **Security Protections:**
  - Contacts Cashfree API server-to-server (`GET /pg/orders/{order_id}`).
  - Validates `order_status === 'PAID'` before setting database record to `SUCCESS`.
  - Prevents replay attacks and fake client confirmation.
  - Logs `DONATION_MUTATION` audit record.

---

### 2.4 File Upload API

#### `POST /api/upload`
- **Access:** Rate limited: 20 uploads / hour per IP
- **Max File Size:** 5 MB
- **Whitelist:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`
- **Deep Inspection:** Verifies binary magic-byte signatures (prevents polyglot malware and hidden scripts).
- **Path Sanitization:** Filenames randomized with cryptographic prefixes (`upload_${Date.now()}_${randSuffix}.${ext}`).

# DATABASE SECURITY POLICIES & ROW LEVEL SECURITY (RLS)

**Database Platform:** Supabase PostgreSQL  
**Migration File:** `frontend/data/migrations/DATABASE_SECURITY_POLICIES.sql`  

---

## 1. Overview of Database Access Model

Database access follows the principle of **Least Privilege**:

- **Service Role (`service_role`):** Used exclusively by trusted server-side Next.js route handlers (`supabaseAdmin`). Bypasses RLS to perform verified operational updates after backend token validation.
- **Authenticated Role (`authenticated`):** Bound to signed user sessions. Allowed to read or modify only rows matching their own identity (`auth.uid() = id` or `auth.jwt() ->> 'email' = email`).
- **Anonymous Role (`anon`):** Restricted strictly to reading public CMS content (causes, blogs, reviews) and submitting public forms (donation creation, contact messages, volunteer applications).

---

## 2. Table-by-Table Row Level Security Policy Explanation

### 2.1 Table: `admin_users`
- **RLS Enabled:** `TRUE`
- **Public / Anon Access:** Completely blocked (`DENY ALL`).
- **Policy:** `Service role full access on admin_users`. Only internal server handlers with `SUPABASE_SERVICE_ROLE_KEY` can query admin credentials.

### 2.2 Table: `audit_logs`
- **RLS Enabled:** `TRUE`
- **Public / Anon Access:** Blocked (`DENY ALL`).
- **Immutability:** Only `service_role` can insert and read logs. No user or admin can perform `UPDATE` or `DELETE`, ensuring an unforgeable, permanent audit trail.

### 2.3 Table: `users`
- **RLS Enabled:** `TRUE`
- **Policy 1 (`Users can read own profile`):**
  ```sql
  CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' = email OR auth.uid()::text = id::text);
  ```
- **Policy 2 (`Users can update own profile`):** Restricts updates to the user's own record. Role modification is prevented.
- **Policy 3 (`Public registration for new users`):** Allows `anon` to create new accounts via standard registration.

### 2.4 Table: `volunteer_applications`
- **RLS Enabled:** `TRUE`
- **Policy 1 (`Public can submit volunteer application`):** Allows public users to submit their volunteer registration (`INSERT`).
- **Policy 2 (`Volunteers can view own record`):** Approved volunteers can view only their own application details (`SELECT`).
- **Policy 3 (`Volunteers can update permitted profile fields`):** Volunteers can update only their own profile details; `status` and certificate fields cannot be altered.
- **Policy 4 (`Service role full access on volunteer_applications`):** Allows admins to manage, approve, reject, or assign certificates.

### 2.5 Table: `donations`
- **RLS Enabled:** `TRUE`
- **Policy 1 (`Public can insert donations`):** Allows visitors to initiate donation records during payment processing (`INSERT`).
- **Policy 2 (`Donors can view their own donations`):** Restricts donor queries (`SELECT`) to rows where `email` matches the authenticated user.
- **Policy 3 (`Service role full access on donations`):** Allows admin dashboard to query reports and verify payment gateway callbacks.

### 2.6 Table: `contact_submissions`
- **RLS Enabled:** `TRUE`
- **Policy 1 (`Public can submit contact inquiries`):** Public users can submit contact inquiries (`INSERT`).
- **Policy 2:** Inquiries can only be read (`SELECT`) or removed (`DELETE`) by `service_role` (Admins).

### 2.7 Public Content Tables (`causes`, `blogs`, `stories`, `reviews`, `page_texts`, `page_media`)
- **RLS Enabled:** `TRUE`
- **Public Policy:** Anyone (`anon`, `authenticated`) can view public content (`SELECT`).
- **Admin Policy:** Only `service_role` can mutate or delete content (`INSERT`, `UPDATE`, `DELETE`).

---

## 3. How to Apply the Migration in Supabase

1. Open your **Supabase Dashboard** -> Project `cwpfhfcxpeqiihiqxqtu`.
2. Navigate to **SQL Editor** in the left sidebar.
3. Open `frontend/data/migrations/DATABASE_SECURITY_POLICIES.sql`.
4. Copy and paste the entire script into the editor.
5. Click **Run**.
6. Verify under **Authentication -> Policies** that all tables display their active RLS shields.

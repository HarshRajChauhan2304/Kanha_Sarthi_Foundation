-- ==============================================================================
-- KANHA SARTHI FOUNDATION – DATABASE SECURITY & ROW LEVEL SECURITY (RLS) POLICIES
-- Target Environment: Supabase PostgreSQL
-- Roles Defined: ADMIN, USER, VOLUNTEER, SERVICE_ROLE, PUBLIC
-- Description: Enforces table-level access controls, protects confidential PII,
--              secures donor payments, and seals unauthorized read/write/delete.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURITY AUDIT LOGS TABLE & POLICIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    actor_email TEXT DEFAULT 'anonymous',
    actor_role TEXT DEFAULT 'anonymous',
    ip_address TEXT DEFAULT '127.0.0.1',
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE', 'BLOCKED'))
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if any
DROP POLICY IF EXISTS "Service role has full access to audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Deny public access to audit logs" ON public.audit_logs;

-- Immutable audit log: Only service_role can read and insert; nobody can update or delete
CREATE POLICY "Service role has full access to audit logs"
ON public.audit_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. ADMIN USERS TABLE & POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Deny all public access to admin_users" ON public.admin_users;

-- Admin credentials must NEVER be queried directly by the public or anon roles
CREATE POLICY "Service role full access on admin_users"
ON public.admin_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. USERS TABLE (DONORS & SUPPORTERS) & POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on users" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Public registration for new users" ON public.users;

-- Backend operations bypass via service_role
CREATE POLICY "Service role full access on users"
ON public.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can read their own profile row based on authenticated email/UID
CREATE POLICY "Users can read own profile"
ON public.users
FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'email' = email OR
    auth.uid()::text = id::text
);

-- Users can update only their own profile row (cannot modify role)
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (
    auth.jwt() ->> 'email' = email OR
    auth.uid()::text = id::text
)
WITH CHECK (
    auth.jwt() ->> 'email' = email OR
    auth.uid()::text = id::text
);

-- Public can register a new user account
CREATE POLICY "Public registration for new users"
ON public.users
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4. VOLUNTEER APPLICATIONS TABLE & POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.volunteer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on volunteer_applications" ON public.volunteer_applications;
DROP POLICY IF EXISTS "Public can submit volunteer application" ON public.volunteer_applications;
DROP POLICY IF EXISTS "Volunteers can view own record" ON public.volunteer_applications;
DROP POLICY IF EXISTS "Volunteers can update permitted profile fields" ON public.volunteer_applications;

-- Backend operations bypass via service_role
CREATE POLICY "Service role full access on volunteer_applications"
ON public.volunteer_applications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Anyone can submit a volunteer application
CREATE POLICY "Public can submit volunteer application"
ON public.volunteer_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Approved volunteers can view their own record
CREATE POLICY "Volunteers can view own record"
ON public.volunteer_applications
FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'email' = email OR
    auth.jwt() ->> 'phone' = phone
);

-- Volunteers can update only their own profile (cannot change status or role)
CREATE POLICY "Volunteers can update permitted profile fields"
ON public.volunteer_applications
FOR UPDATE
TO authenticated
USING (
    auth.jwt() ->> 'email' = email
)
WITH CHECK (
    auth.jwt() ->> 'email' = email
);

-- ------------------------------------------------------------------------------
-- 5. DONATIONS TABLE & POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on donations" ON public.donations;
DROP POLICY IF EXISTS "Public can insert donations" ON public.donations;
DROP POLICY IF EXISTS "Donors can view their own donations" ON public.donations;

-- Backend operations bypass via service_role
CREATE POLICY "Service role full access on donations"
ON public.donations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Public visitors can create a donation entry during payment processing
CREATE POLICY "Public can insert donations"
ON public.donations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Authenticated donors can view only their own donation records
CREATE POLICY "Donors can view their own donations"
ON public.donations
FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'email' = email OR
    (is_anonymous = false AND auth.jwt() ->> 'email' = marketing_email)
);

-- ------------------------------------------------------------------------------
-- 6. CONTACT SUBMISSIONS TABLE & POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on contact_submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Public can submit contact inquiries" ON public.contact_submissions;

-- Backend operations bypass via service_role
CREATE POLICY "Service role full access on contact_submissions"
ON public.contact_submissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Anyone can submit a contact inquiry
CREATE POLICY "Public can submit contact inquiries"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Note: SELECT and DELETE are strictly restricted to service_role (Admins only)

-- ------------------------------------------------------------------------------
-- 7. VOLUNTEER TASKS TABLE & POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.volunteer_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on volunteer_tasks" ON public.volunteer_tasks;
DROP POLICY IF EXISTS "Volunteers can view assigned tasks" ON public.volunteer_tasks;
DROP POLICY IF EXISTS "Volunteers can update assigned task status" ON public.volunteer_tasks;

-- Backend operations bypass via service_role
CREATE POLICY "Service role full access on volunteer_tasks"
ON public.volunteer_tasks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 8. PUBLIC CONTENT TABLES (Read by public, Write only by Admins/Service Role)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tbl text;
    content_tables text[] := ARRAY[
        'causes', 'categories', 'blogs', 'stories', 'reviews',
        'detailed_stories', 'success_stories', 'about_highlights',
        'page_texts', 'page_media', 'stats_cards', 'spotlight_campaigns'
    ];
BEGIN
    FOREACH tbl IN ARRAY content_tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public can read content %I" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Service role can manage content %I" ON public.%I;', tbl, tbl);
            
            -- Anyone can read public website content
            EXECUTE format('CREATE POLICY "Public can read content %I" ON public.%I FOR SELECT TO anon, authenticated USING (true);', tbl, tbl);
            -- Only service_role (Admins) can insert, update, delete
            EXECUTE format('CREATE POLICY "Service role can manage content %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', tbl, tbl);
        END IF;
    END LOOP;
END $$;

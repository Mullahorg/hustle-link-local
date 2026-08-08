-- ============ 1. Roles ============
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_agent';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'verification_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'content_moderator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'analyst';

-- ============ 2. Permission catalogue ============
DO $$ BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'users.read','users.write',
    'roles.read','roles.write',
    'verification.read','verification.write',
    'jobs.read','jobs.write',
    'applications.read','applications.write',
    'workers.read','workers.write',
    'employers.read','employers.write',
    'messages.read','messages.moderate',
    'reports.read','reports.write',
    'reviews.read','reviews.write',
    'notifications.read','notifications.write',
    'categories.read','categories.write',
    'settings.read','settings.write',
    'payments.read','payments.write',
    'analytics.read',
    'audit.read'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission public.app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- ============ 3. Audit log ============
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_idx ON public.admin_audit_logs (entity_type, entity_id);
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ 4. App settings ============
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============ 5. Payments ============
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'payhero',
  purpose text NOT NULL,
  reference text NOT NULL UNIQUE,
  provider_reference text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  attempts integer NOT NULL DEFAULT 0,
  idempotency_key text UNIQUE,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_transactions_user_idx ON public.payment_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON public.payment_transactions (status, created_at DESC);
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'payhero',
  event_id text NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER payment_transactions_updated BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 6. Moderation columns ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_reason text;

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- ============ 7. Permission helper ============
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission public.app_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role <> 'user'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE(permission public.app_permission)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT rp.permission
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  WHERE ur.user_id = auth.uid();
$$;

-- ============ 8. RLS policies for new tables ============
DROP POLICY IF EXISTS "staff read role permissions" ON public.role_permissions;
CREATE POLICY "staff read role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "audit readable by permitted staff" ON public.admin_audit_logs;
CREATE POLICY "audit readable by permitted staff" ON public.admin_audit_logs
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'audit.read'));

DROP POLICY IF EXISTS "settings readable by permitted staff" ON public.app_settings;
CREATE POLICY "settings readable by permitted staff" ON public.app_settings
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'settings.read'));

DROP POLICY IF EXISTS "own or staff payments" ON public.payment_transactions;
CREATE POLICY "own or staff payments" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'payments.read'));

DROP POLICY IF EXISTS "staff read webhook events" ON public.payment_webhook_events;
CREATE POLICY "staff read webhook events" ON public.payment_webhook_events
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'payments.read'));

-- staff visibility over existing tables
DROP POLICY IF EXISTS "staff read applications" ON public.job_applications;
CREATE POLICY "staff read applications" ON public.job_applications
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'applications.read'));

DROP POLICY IF EXISTS "staff read verification" ON public.verification_requests;
CREATE POLICY "staff read verification" ON public.verification_requests
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'verification.read'));

DROP POLICY IF EXISTS "staff read reports" ON public.reports;
CREATE POLICY "staff read reports" ON public.reports
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'reports.read'));

DROP POLICY IF EXISTS "staff read jobs" ON public.jobs;
CREATE POLICY "staff read jobs" ON public.jobs
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'jobs.read'));

DROP POLICY IF EXISTS "staff read roles" ON public.user_roles;
CREATE POLICY "staff read roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'roles.read'));

-- hidden jobs stay out of the public feed
DROP POLICY IF EXISTS "open jobs are public" ON public.jobs;
CREATE POLICY "open jobs are public" ON public.jobs
  FOR SELECT TO anon, authenticated
  USING (status <> 'closed'::public.job_status AND hidden_at IS NULL);

-- ============ 9. Search excludes suspended/hidden ============
CREATE OR REPLACE FUNCTION public.search_jobs(_q text DEFAULT NULL, _category text DEFAULT NULL, _area text DEFAULT NULL, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS TABLE(id uuid, title text, description text, category_slug text, area text, budget_min integer, budget_max integer, budget_note text, urgent boolean, applicants_count integer, created_at timestamptz, employer_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.id, j.title, j.description, j.category_slug, j.area, j.budget_min, j.budget_max,
         j.budget_note, j.urgent, j.applicants_count, j.created_at, p.full_name
  FROM public.jobs j
  LEFT JOIN public.profiles p ON p.id = j.employer_id
  WHERE j.status = 'open' AND j.hidden_at IS NULL AND p.suspended_at IS NULL
    AND (_category IS NULL OR j.category_slug = _category)
    AND (_area IS NULL OR j.area ILIKE '%' || _area || '%')
    AND (_q IS NULL OR _q = '' OR j.search_vector @@ plainto_tsquery('simple', _q))
  ORDER BY j.urgent DESC, j.created_at DESC
  LIMIT LEAST(COALESCE(_limit,20), 50) OFFSET GREATEST(COALESCE(_offset,0),0);
$$;

CREATE OR REPLACE FUNCTION public.search_workers(_q text DEFAULT NULL, _category text DEFAULT NULL, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS TABLE(id uuid, full_name text, headline text, area text, category_slug text, skills text[], rate_label text, rating_avg numeric, rating_count integer, verification public.verification_status, avatar_url text, available boolean, last_seen_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.headline, p.area, p.category_slug, p.skills, p.rate_label,
         p.rating_avg, p.rating_count, p.verification, p.avatar_url, p.available, p.last_seen_at
  FROM public.profiles p
  WHERE p.is_worker AND p.suspended_at IS NULL
    AND (_category IS NULL OR p.category_slug = _category)
    AND (_q IS NULL OR _q = '' OR p.search_vector @@ plainto_tsquery('simple', _q))
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocked_id = auth.uid() AND b.blocker_id = p.id)
    )
  ORDER BY p.available DESC, (p.verification = 'verified') DESC, p.rating_avg DESC, p.rating_count DESC
  LIMIT LEAST(COALESCE(_limit,20), 50) OFFSET GREATEST(COALESCE(_offset,0),0);
$$;
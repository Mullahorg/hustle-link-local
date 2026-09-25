-- ============================ business accounts ============================
DO $$ BEGIN
  CREATE TYPE public.business_role AS ENUM ('owner','manager','finance','staff','driver','support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  about text,
  category_slug text REFERENCES public.market_categories(slug),
  phone text,
  email text,
  area text NOT NULL DEFAULT '',
  logo_url text,
  registration_no text,
  verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.businesses TO anon;
GRANT SELECT, INSERT, UPDATE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.business_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.business_role_of(_business_id uuid, _user_id uuid)
RETURNS public.business_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.business_members
  WHERE business_id = _business_id AND user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.business_can_manage(_business_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.owner_id = _user_id)
      OR public.business_role_of(_business_id, _user_id) IN ('owner','manager')
$$;

DROP POLICY IF EXISTS "Businesses are public" ON public.businesses;
CREATE POLICY "Businesses are public" ON public.businesses
  FOR SELECT USING (status = 'active' OR owner_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Owner creates business" ON public.businesses;
CREATE POLICY "Owner creates business" ON public.businesses
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Managers update business" ON public.businesses;
CREATE POLICY "Managers update business" ON public.businesses
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.business_can_manage(id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.business_can_manage(id, auth.uid()));

DROP POLICY IF EXISTS "Members read team" ON public.business_members;
CREATE POLICY "Members read team" ON public.business_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.business_can_manage(business_id, auth.uid()) OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Managers add team" ON public.business_members;
CREATE POLICY "Managers add team" ON public.business_members
  FOR INSERT TO authenticated WITH CHECK (public.business_can_manage(business_id, auth.uid()));

DROP POLICY IF EXISTS "Managers change team" ON public.business_members;
CREATE POLICY "Managers change team" ON public.business_members
  FOR UPDATE TO authenticated
  USING (public.business_can_manage(business_id, auth.uid()))
  WITH CHECK (public.business_can_manage(business_id, auth.uid()));

DROP POLICY IF EXISTS "Managers remove team" ON public.business_members;
CREATE POLICY "Managers remove team" ON public.business_members
  FOR DELETE TO authenticated USING (public.business_can_manage(business_id, auth.uid()));

DROP TRIGGER IF EXISTS businesses_updated_at ON public.businesses;
CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- listings and jobs can belong to a business
ALTER TABLE public.market_listings ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

-- ============================ storage lifecycle ============================
ALTER TABLE public.market_listings ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.market_listings ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS market_listings_archived_idx ON public.market_listings (archived_at);
CREATE INDEX IF NOT EXISTS market_listings_business_idx ON public.market_listings (business_id);

-- ============================ platform events ============================
CREATE TABLE IF NOT EXISTS public.platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  actor_id uuid,
  subject_type text,
  subject_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_events_kind_idx ON public.platform_events (kind, created_at DESC);
GRANT SELECT ON public.platform_events TO authenticated;
GRANT ALL ON public.platform_events TO service_role;
ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read events" ON public.platform_events;
CREATE POLICY "Staff read events" ON public.platform_events
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.emit_event(_kind text, _subject_type text, _subject_id text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.platform_events (kind, actor_id, subject_type, subject_id, payload)
  VALUES (_kind, auth.uid(), _subject_type, _subject_id, coalesce(_payload, '{}'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.on_job_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_event('job.posted', 'job', NEW.id::text, jsonb_build_object('title', NEW.title, 'area', NEW.area));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.emit_event('job.' || NEW.status::text, 'job', NEW.id::text, jsonb_build_object('title', NEW.title));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jobs_event ON public.jobs;
CREATE TRIGGER jobs_event AFTER INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.on_job_event();

CREATE OR REPLACE FUNCTION public.on_order_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_event('order.created', 'order', NEW.id::text,
      jsonb_build_object('title', NEW.title, 'amount_cents', NEW.amount_cents));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.emit_event('order.' || NEW.status, 'order', NEW.id::text,
      jsonb_build_object('title', NEW.title, 'amount_cents', NEW.amount_cents));
  ELSIF NEW.fulfilment_status IS DISTINCT FROM OLD.fulfilment_status THEN
    PERFORM public.emit_event('order.' || NEW.fulfilment_status, 'order', NEW.id::text,
      jsonb_build_object('title', NEW.title));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_event ON public.market_orders;
CREATE TRIGGER orders_event AFTER INSERT OR UPDATE ON public.market_orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_event();

CREATE OR REPLACE FUNCTION public.on_review_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.emit_event('review.added', 'review', NEW.id::text, jsonb_build_object('rating', NEW.rating));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reviews_event ON public.reviews;
CREATE TRIGGER reviews_event AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.on_review_event();

-- ============================ feature flags ============================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Flags are readable" ON public.feature_flags;
CREATE POLICY "Flags are readable" ON public.feature_flags FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.admin_set_flag(_key text, _label text, _enabled boolean, _description text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('settings.write');
  INSERT INTO public.feature_flags (key, label, description, enabled, updated_at, updated_by)
  VALUES (_key, _label, _description, _enabled, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET label = EXCLUDED.label,
        description = coalesce(EXCLUDED.description, public.feature_flags.description),
        enabled = EXCLUDED.enabled,
        updated_at = now(),
        updated_by = auth.uid();
  PERFORM public.write_audit('feature_flag.set', 'feature_flag', _key, jsonb_build_object('enabled', _enabled));
  RETURN jsonb_build_object('ok', true);
END $$;

-- ============================ push subscriptions ============================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================ search log ============================
CREATE TABLE IF NOT EXISTS public.search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  term text NOT NULL,
  scope text NOT NULL DEFAULT 'all',
  results integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_queries_term_idx ON public.search_queries (created_at DESC);
GRANT SELECT, INSERT ON public.search_queries TO authenticated;
GRANT ALL ON public.search_queries TO service_role;
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own searches" ON public.search_queries;
CREATE POLICY "Own searches" ON public.search_queries
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Log own search" ON public.search_queries;
CREATE POLICY "Log own search" ON public.search_queries
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
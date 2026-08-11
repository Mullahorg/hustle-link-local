-- ============ enums
DO $$ BEGIN
  CREATE TYPE public.id_document_type AS ENUM ('national_id','passport','driving_licence');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ verification requests
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS doc_type public.id_document_type NOT NULL DEFAULT 'national_id',
  ADD COLUMN IF NOT EXISTS front_path text,
  ADD COLUMN IF NOT EXISTS back_path text,
  ADD COLUMN IF NOT EXISTS selfie_path text,
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS verification_requests_updated ON public.verification_requests;
CREATE TRIGGER verification_requests_updated BEFORE UPDATE ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.verification_requests(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  status public.verification_status,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.verification_events TO authenticated;
GRANT ALL ON public.verification_events TO service_role;
ALTER TABLE public.verification_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own or staff read verification history" ON public.verification_events;
CREATE POLICY "own or staff read verification history" ON public.verification_events
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_permission(auth.uid(),'verification.read'));

-- ============ profile extras
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trades text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS cover_url text;

-- ============ portfolio
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.portfolio_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_items TO authenticated;
GRANT ALL ON public.portfolio_items TO service_role;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portfolio readable" ON public.portfolio_items;
CREATE POLICY "portfolio readable" ON public.portfolio_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "portfolio owned" ON public.portfolio_items;
CREATE POLICY "portfolio owned" ON public.portfolio_items FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS portfolio_items_user_idx ON public.portfolio_items(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.limit_portfolio_items()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.portfolio_items WHERE user_id = NEW.user_id) >= 12 THEN
    RAISE EXCEPTION 'You can keep up to 12 work photos. Remove one first.';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS portfolio_items_limit ON public.portfolio_items;
CREATE TRIGGER portfolio_items_limit BEFORE INSERT ON public.portfolio_items
FOR EACH ROW EXECUTE FUNCTION public.limit_portfolio_items();

CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  issuer text,
  year integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.certificates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "certificates readable" ON public.certificates;
CREATE POLICY "certificates readable" ON public.certificates FOR SELECT USING (true);
DROP POLICY IF EXISTS "certificates owned" ON public.certificates;
CREATE POLICY "certificates owned" ON public.certificates FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ job skills
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}';

-- ============ verification submission
CREATE OR REPLACE FUNCTION public.submit_verification(
  _doc_type public.id_document_type,
  _front_path text,
  _back_path text,
  _selfie_path text,
  _last4 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_attempt integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
  IF _front_path IS NULL OR _selfie_path IS NULL THEN
    RAISE EXCEPTION 'Add your document photo and a live selfie';
  END IF;
  IF EXISTS (SELECT 1 FROM public.verification_requests WHERE user_id=v_uid AND status='pending') THEN
    RAISE EXCEPTION 'Your last submission is still being reviewed';
  END IF;
  SELECT COALESCE(max(attempt),0)+1 INTO v_attempt FROM public.verification_requests WHERE user_id=v_uid;

  INSERT INTO public.verification_requests
    (user_id, doc_type, front_path, back_path, selfie_path, document_path, id_number_last4, status, attempt)
  VALUES (v_uid,_doc_type,_front_path,_back_path,_selfie_path,_front_path,_last4,'pending',v_attempt)
  RETURNING id INTO v_id;

  UPDATE public.profiles SET verification='pending' WHERE id=v_uid;
  INSERT INTO public.verification_events (request_id,user_id,actor_id,action,status)
  VALUES (v_id,v_uid,v_uid,'submitted','pending');
  RETURN jsonb_build_object('ok',true,'id',v_id,'attempt',v_attempt);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_verification(_id uuid, _status verification_status, _notes text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid;
BEGIN
  PERFORM public.require_permission('verification.write');
  UPDATE public.verification_requests
     SET status=_status, review_notes=_notes, reviewed_by=auth.uid(), reviewed_at=now()
   WHERE id=_id RETURNING user_id INTO v_user;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _status IN ('verified','rejected','unverified') THEN
    UPDATE public.profiles SET verification=_status WHERE id=v_user;
  END IF;
  INSERT INTO public.verification_events (request_id,user_id,actor_id,action,status,notes)
  VALUES (_id,v_user,auth.uid(),'reviewed',_status,_notes);
  PERFORM public.push_notification(v_user,'verification',
    CASE _status WHEN 'verified' THEN 'Your ID was verified'
                 WHEN 'rejected' THEN 'Your verification was rejected'
                 ELSE 'We need more information for your verification' END,
    _notes, '/settings');
  PERFORM public.write_audit('verification.'||_status::text,'verification_request',_id::text, jsonb_build_object('user_id',v_user,'notes',_notes));
  RETURN jsonb_build_object('ok', true);
END; $function$;

-- ============ richer search
DROP FUNCTION IF EXISTS public.search_jobs(text,text,text,integer,integer);
CREATE FUNCTION public.search_jobs(_q text DEFAULT NULL::text, _category text DEFAULT NULL::text, _area text DEFAULT NULL::text, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, title text, description text, category_slug text, area text, budget_min integer, budget_max integer, budget_note text, urgent boolean, applicants_count integer, created_at timestamp with time zone, employer_name text, employer_id uuid, employer_verification verification_status, employer_avatar text, skills text[], payment_secured boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT j.id, j.title, j.description, j.category_slug, j.area, j.budget_min, j.budget_max,
         j.budget_note, j.urgent, j.applicants_count, j.created_at, p.full_name, j.employer_id,
         p.verification, p.avatar_url, j.skills,
         EXISTS (SELECT 1 FROM public.job_escrows e WHERE e.job_id=j.id AND e.status IN ('secured','in_progress','awaiting_confirmation'))
  FROM public.jobs j
  LEFT JOIN public.profiles p ON p.id = j.employer_id
  WHERE j.status = 'open' AND j.hidden_at IS NULL AND p.suspended_at IS NULL
    AND (_category IS NULL OR j.category_slug = _category)
    AND (_area IS NULL OR j.area ILIKE '%' || _area || '%')
    AND (_q IS NULL OR _q = '' OR j.search_vector @@ plainto_tsquery('simple', _q))
  ORDER BY j.urgent DESC, j.created_at DESC
  LIMIT LEAST(COALESCE(_limit,20), 50) OFFSET GREATEST(COALESCE(_offset,0),0);
$function$;

DROP FUNCTION IF EXISTS public.search_workers(text,text,integer,integer);
CREATE FUNCTION public.search_workers(_q text DEFAULT NULL::text, _category text DEFAULT NULL::text, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, full_name text, headline text, area text, category_slug text, skills text[], rate_label text, rating_avg numeric, rating_count integer, verification verification_status, avatar_url text, available boolean, last_seen_at timestamp with time zone, completed_jobs integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.headline, p.area, p.category_slug, p.skills, p.rate_label,
         p.rating_avg, p.rating_count, p.verification, p.avatar_url, p.available, p.last_seen_at,
         (SELECT count(*)::int FROM public.job_applications a JOIN public.jobs j ON j.id=a.job_id
           WHERE a.worker_id=p.id AND a.status='accepted' AND j.status='completed')
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
$function$;

-- ============ public profile summary
CREATE OR REPLACE FUNCTION public.public_profile(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.profiles; v_completed int; v_convs int; v_replied int; v_minutes numeric; v_rate numeric; v_trust int;
BEGIN
  SELECT * INTO v_p FROM public.profiles WHERE id=_id;
  IF v_p.id IS NULL OR v_p.suspended_at IS NOT NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_completed FROM public.job_applications a
    JOIN public.jobs j ON j.id=a.job_id
   WHERE a.worker_id=_id AND a.status='accepted' AND j.status='completed';

  SELECT count(*) INTO v_convs FROM public.conversations c WHERE _id IN (c.user_a,c.user_b);
  SELECT count(*) INTO v_replied FROM public.conversations c
   WHERE _id IN (c.user_a,c.user_b)
     AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id=c.id AND m.sender_id=_id)
     AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id=c.id AND m.sender_id<>_id);
  v_rate := CASE WHEN v_convs>0 THEN v_replied::numeric/v_convs ELSE NULL END;

  SELECT avg(diff) INTO v_minutes FROM (
    SELECT extract(epoch FROM (min(r.created_at) - m.created_at))/60 AS diff
    FROM public.messages m
    JOIN public.conversations c ON c.id=m.conversation_id
    LEFT JOIN public.messages r ON r.conversation_id=m.conversation_id AND r.sender_id=_id AND r.created_at>m.created_at
    WHERE _id IN (c.user_a,c.user_b) AND m.sender_id<>_id
    GROUP BY m.id, m.created_at
    HAVING min(r.created_at) IS NOT NULL
    ORDER BY m.created_at DESC
    LIMIT 50) t;

  v_trust := LEAST(100, GREATEST(0,
      (CASE WHEN v_p.verification='verified' THEN 30 ELSE 0 END)
    + round(COALESCE(v_p.rating_avg,0)/5*35)
    + LEAST(20, v_completed*2)
    + round(COALESCE(v_rate,0)*15)));

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_p) - 'phone' - 'suspension_reason' - 'search_vector',
    'stats', jsonb_build_object(
      'trust_score', v_trust,
      'completed_jobs', v_completed,
      'response_rate', v_rate,
      'response_minutes', round(COALESCE(v_minutes,0)),
      'conversations', v_convs),
    'portfolio', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb)
                    FROM (SELECT id, image_path, caption, created_at FROM public.portfolio_items WHERE user_id=_id LIMIT 12) x),
    'certificates', (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.year DESC NULLS LAST),'[]'::jsonb)
                    FROM (SELECT id, title, issuer, year FROM public.certificates WHERE user_id=_id LIMIT 20) c),
    'recent_work', (SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM (
        SELECT j.id, j.title, j.category_slug, j.area, j.created_at
        FROM public.job_applications a JOIN public.jobs j ON j.id=a.job_id
        WHERE a.worker_id=_id AND a.status='accepted' AND j.status='completed'
        ORDER BY j.updated_at DESC LIMIT 5) w)
  );
END; $$;
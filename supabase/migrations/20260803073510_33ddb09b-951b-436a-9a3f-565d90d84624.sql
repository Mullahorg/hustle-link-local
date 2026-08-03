
-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('user','moderator','admin');
CREATE TYPE public.job_status AS ENUM ('open','in_progress','completed','closed');
CREATE TYPE public.application_status AS ENUM ('sent','shortlisted','accepted','rejected','withdrawn');
CREATE TYPE public.verification_status AS ENUM ('unverified','pending','verified','rejected');
CREATE TYPE public.report_status AS ENUM ('open','reviewing','resolved','dismissed');

-- ========== UTIL ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.profile_search_doc(_full_name TEXT, _headline TEXT, _area TEXT, _skills TEXT[])
RETURNS tsvector LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT to_tsvector('simple',
    coalesce(_full_name,'') || ' ' || coalesce(_headline,'') || ' ' || coalesce(_area,'') || ' ' ||
    coalesce((SELECT string_agg(s, ' ') FROM unnest(coalesce(_skills,'{}'::text[])) AS s), ''));
$$;

-- ========== CATEGORIES ==========
CREATE TABLE public.categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Wrench',
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories are public" ON public.categories FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.categories (slug,name,icon,sort_order) VALUES
 ('electrician','Electrician','Zap',1),
 ('plumber','Plumber','Droplets',2),
 ('mechanic','Mechanic','Wrench',3),
 ('cleaner','House cleaning','Sparkles',4),
 ('painter','Painter','PaintRoller',5),
 ('tutor','Tutor','GraduationCap',6),
 ('welder','Welder','Flame',7),
 ('hairdresser','Hairdresser','Scissors',8),
 ('driver','Driver','Car',9),
 ('farmer','Farm work','Sprout',10),
 ('carpenter','Carpenter','Hammer',11),
 ('mason','Mason','Layers',12);

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'New member',
  headline TEXT,
  bio TEXT,
  area TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_worker BOOLEAN NOT NULL DEFAULT false,
  category_slug TEXT REFERENCES public.categories(slug) ON DELETE SET NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  rate_label TEXT,
  verification verification_status NOT NULL DEFAULT 'unverified',
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (public.profile_search_doc(full_name, headline, area, skills)) STORED
);
CREATE INDEX profiles_search_idx ON public.profiles USING GIN (search_vector);
CREATE INDEX profiles_worker_idx ON public.profiles (is_worker, rating_avg DESC);
CREATE INDEX profiles_category_idx ON public.profiles (category_slug) WHERE is_worker;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by everyone" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== ROLES ==========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, area, phone)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NULLIF(NEW.raw_user_meta_data->>'name',''), split_part(COALESCE(NEW.email,'member'),'@',1)),
    NEW.raw_user_meta_data->>'area',
    NEW.raw_user_meta_data->>'phone'
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== JOBS ==========
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_slug TEXT NOT NULL REFERENCES public.categories(slug),
  area TEXT NOT NULL,
  budget_min INT,
  budget_max INT,
  budget_note TEXT,
  urgent BOOLEAN NOT NULL DEFAULT false,
  status job_status NOT NULL DEFAULT 'open',
  applicants_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(area,'') || ' ' || coalesce(category_slug,''))
  ) STORED
);
CREATE INDEX jobs_search_idx ON public.jobs USING GIN (search_vector);
CREATE INDEX jobs_feed_idx ON public.jobs (status, created_at DESC);
CREATE INDEX jobs_category_idx ON public.jobs (category_slug, status, created_at DESC);
CREATE INDEX jobs_employer_idx ON public.jobs (employer_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT ON public.jobs TO anon;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open jobs are public" ON public.jobs FOR SELECT TO anon, authenticated USING (status <> 'closed');
CREATE POLICY "owners read own jobs" ON public.jobs FOR SELECT TO authenticated USING (auth.uid() = employer_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "create own jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = employer_id);
CREATE POLICY "update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = employer_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = employer_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "delete own jobs" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = employer_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== NOTIFICATIONS ==========
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.push_notification(_user_id UUID, _kind TEXT, _title TEXT, _body TEXT, _link TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  VALUES (_user_id, _kind, _title, _body, _link);
END; $$;

-- ========== APPLICATIONS ==========
CREATE TABLE public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status application_status NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, worker_id)
);
CREATE INDEX applications_worker_idx ON public.job_applications (worker_id, created_at DESC);
CREATE INDEX applications_job_idx ON public.job_applications (job_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applicant reads own" ON public.job_applications FOR SELECT TO authenticated USING (auth.uid() = worker_id);
CREATE POLICY "employer reads applications" ON public.job_applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.employer_id = auth.uid()));
CREATE POLICY "apply as self" ON public.job_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "applicant updates own" ON public.job_applications FOR UPDATE TO authenticated USING (auth.uid() = worker_id) WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "employer updates status" ON public.job_applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.employer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.employer_id = auth.uid()));
CREATE POLICY "applicant withdraws" ON public.job_applications FOR DELETE TO authenticated USING (auth.uid() = worker_id);
CREATE TRIGGER applications_updated BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.on_application_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job RECORD; v_name TEXT; v_title TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.jobs SET applicants_count = applicants_count + 1 WHERE id = NEW.job_id
      RETURNING id, title, employer_id INTO v_job;
    SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.worker_id;
    PERFORM public.push_notification(v_job.employer_id,'application',
      COALESCE(v_name,'Someone') || ' applied to your job', v_job.title, '/jobs/' || v_job.id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.jobs SET applicants_count = GREATEST(applicants_count - 1, 0) WHERE id = OLD.job_id;
    RETURN OLD;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      SELECT title INTO v_title FROM public.jobs WHERE id = NEW.job_id;
      PERFORM public.push_notification(NEW.worker_id,'application',
        'Your application is now ' || NEW.status::text, v_title, '/activity');
    END IF;
    RETURN NEW;
  END IF;
END; $$;
CREATE TRIGGER applications_side_effects
AFTER INSERT OR UPDATE OR DELETE ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.on_application_change();

-- ========== SAVED JOBS / FAVOURITES ==========
CREATE TABLE public.saved_jobs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_jobs TO authenticated;
GRANT ALL ON public.saved_jobs TO service_role;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved jobs" ON public.saved_jobs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.favorite_workers (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, worker_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorite_workers TO authenticated;
GRANT ALL ON public.favorite_workers TO service_role;
ALTER TABLE public.favorite_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favourites" ON public.favorite_workers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== CHAT ==========
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
CREATE INDEX conversations_a_idx ON public.conversations (user_a, last_message_at DESC);
CREATE INDEX conversations_b_idx ON public.conversations (user_b, last_message_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read conversation" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() IN (user_a, user_b));
CREATE POLICY "participants create conversation" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (user_a, user_b));

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = _conversation_id AND _user_id IN (c.user_a, c.user_b));
$$;

CREATE POLICY "participants read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "participants send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "participants mark read" ON public.messages FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()))
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conv RECORD; v_other UUID; v_name TEXT;
BEGIN
  UPDATE public.conversations SET last_message = NEW.body, last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id RETURNING user_a, user_b INTO v_conv;
  v_other := CASE WHEN v_conv.user_a = NEW.sender_id THEN v_conv.user_b ELSE v_conv.user_a END;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.sender_id;
  PERFORM public.push_notification(v_other,'message', COALESCE(v_name,'Someone') || ' sent you a message', left(NEW.body, 120), '/messages');
  RETURN NEW;
END; $$;
CREATE TRIGGER messages_side_effects AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.on_message_insert();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ========== REVIEWS ==========
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reviewer_id <> subject_id),
  UNIQUE (reviewer_id, subject_id, job_id)
);
CREATE INDEX reviews_subject_idx ON public.reviews (subject_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews are public" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "write own review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "edit own review" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "remove own review" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);

CREATE OR REPLACE FUNCTION public.on_review_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_subject UUID; v_name TEXT;
BEGIN
  v_subject := COALESCE(NEW.subject_id, OLD.subject_id);
  UPDATE public.profiles p SET
    rating_avg = COALESCE((SELECT ROUND(AVG(r.rating)::numeric,2) FROM public.reviews r WHERE r.subject_id = v_subject),0),
    rating_count = (SELECT COUNT(*) FROM public.reviews r WHERE r.subject_id = v_subject)
  WHERE p.id = v_subject;
  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.reviewer_id;
    PERFORM public.push_notification(NEW.subject_id,'review', COALESCE(v_name,'Someone') || ' left you a ' || NEW.rating || ' star review', NEW.body, '/profile');
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER reviews_side_effects AFTER INSERT OR UPDATE OR DELETE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.on_review_change();

-- ========== REPORTS ==========
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reports_status_idx ON public.reports (status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporter or admin reads" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "report as self" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "moderators update reports" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- ========== VERIFICATION ==========
CREATE TABLE public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_path TEXT,
  id_number_last4 TEXT,
  status verification_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX verification_user_idx ON public.verification_requests (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin reads verification" ON public.verification_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "request own verification" ON public.verification_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin updates verification" ON public.verification_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== FAST READ RPCs ==========
CREATE OR REPLACE FUNCTION public.search_jobs(_q TEXT DEFAULT NULL, _category TEXT DEFAULT NULL, _area TEXT DEFAULT NULL, _limit INT DEFAULT 20, _offset INT DEFAULT 0)
RETURNS TABLE (
  id UUID, title TEXT, description TEXT, category_slug TEXT, area TEXT,
  budget_min INT, budget_max INT, budget_note TEXT, urgent BOOLEAN,
  applicants_count INT, created_at TIMESTAMPTZ, employer_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.id, j.title, j.description, j.category_slug, j.area, j.budget_min, j.budget_max,
         j.budget_note, j.urgent, j.applicants_count, j.created_at, p.full_name
  FROM public.jobs j
  LEFT JOIN public.profiles p ON p.id = j.employer_id
  WHERE j.status = 'open'
    AND (_category IS NULL OR j.category_slug = _category)
    AND (_area IS NULL OR j.area ILIKE '%' || _area || '%')
    AND (_q IS NULL OR _q = '' OR j.search_vector @@ plainto_tsquery('simple', _q))
  ORDER BY j.urgent DESC, j.created_at DESC
  LIMIT LEAST(COALESCE(_limit,20), 50) OFFSET GREATEST(COALESCE(_offset,0),0);
$$;
GRANT EXECUTE ON FUNCTION public.search_jobs(TEXT,TEXT,TEXT,INT,INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_workers(_q TEXT DEFAULT NULL, _category TEXT DEFAULT NULL, _limit INT DEFAULT 20, _offset INT DEFAULT 0)
RETURNS TABLE (
  id UUID, full_name TEXT, headline TEXT, area TEXT, category_slug TEXT, skills TEXT[],
  rate_label TEXT, rating_avg NUMERIC, rating_count INT, verification verification_status, avatar_url TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.headline, p.area, p.category_slug, p.skills, p.rate_label,
         p.rating_avg, p.rating_count, p.verification, p.avatar_url
  FROM public.profiles p
  WHERE p.is_worker
    AND (_category IS NULL OR p.category_slug = _category)
    AND (_q IS NULL OR _q = '' OR p.search_vector @@ plainto_tsquery('simple', _q))
  ORDER BY (p.verification = 'verified') DESC, p.rating_avg DESC, p.rating_count DESC
  LIMIT LEAST(COALESCE(_limit,20), 50) OFFSET GREATEST(COALESCE(_offset,0),0);
$$;
GRANT EXECUTE ON FUNCTION public.search_workers(TEXT,TEXT,INT,INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.home_feed()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'categories', (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.sort_order),'[]'::jsonb) FROM (
        SELECT c.slug, c.name, c.icon, c.sort_order,
               (SELECT COUNT(*) FROM public.jobs j WHERE j.category_slug = c.slug AND j.status='open') AS open_jobs
        FROM public.categories c) c),
    'jobs', (SELECT COALESCE(jsonb_agg(to_jsonb(j)),'[]'::jsonb) FROM (
        SELECT * FROM public.search_jobs(NULL,NULL,NULL,6,0)) j),
    'workers', (SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM (
        SELECT * FROM public.search_workers(NULL,NULL,6,0)) w)
  );
$$;
GRANT EXECUTE ON FUNCTION public.home_feed() TO anon, authenticated;

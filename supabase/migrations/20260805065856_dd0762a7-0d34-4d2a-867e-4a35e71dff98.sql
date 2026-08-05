-- Blocked users
CREATE TABLE public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own blocks" ON public.blocked_users
  FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- Availability + presence
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles (last_seen_at DESC);

-- Extend worker search with availability + presence
DROP FUNCTION IF EXISTS public.search_workers(text, text, integer, integer);

CREATE FUNCTION public.search_workers(
  _q text DEFAULT NULL,
  _category text DEFAULT NULL,
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, full_name text, headline text, area text, category_slug text, skills text[],
  rate_label text, rating_avg numeric, rating_count integer, verification verification_status,
  avatar_url text, available boolean, last_seen_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.full_name, p.headline, p.area, p.category_slug, p.skills, p.rate_label,
         p.rating_avg, p.rating_count, p.verification, p.avatar_url, p.available, p.last_seen_at
  FROM public.profiles p
  WHERE p.is_worker
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

REVOKE ALL ON FUNCTION public.search_workers(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_workers(text, text, integer, integer) TO anon, authenticated, service_role;
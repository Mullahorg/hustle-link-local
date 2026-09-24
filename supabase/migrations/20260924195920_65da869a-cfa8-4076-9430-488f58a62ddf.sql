DROP POLICY IF EXISTS "apply as self" ON public.job_applications;
CREATE POLICY "apply as self" ON public.job_applications
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = worker_id
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.verification = 'verified'
  )
);

CREATE OR REPLACE FUNCTION public.admin_verification_trail(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.require_permission('verification.read');
  SELECT jsonb_build_object(
    'requests', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM (
        SELECT id, doc_type, status, attempt, id_number_last4, review_notes,
               front_path, back_path, selfie_path, created_at, reviewed_at
        FROM public.verification_requests WHERE user_id = _user_id
      ) r
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC) FROM (
        SELECT ev.id, ev.action, ev.status, ev.notes, ev.created_at,
               COALESCE(p.full_name, 'Member') AS actor_name
        FROM public.verification_events ev
        LEFT JOIN public.profiles p ON p.id = ev.actor_id
        WHERE ev.user_id = _user_id
      ) e
    ), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END; $$;

REVOKE ALL ON FUNCTION public.admin_verification_trail(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_verification_trail(uuid) TO authenticated;
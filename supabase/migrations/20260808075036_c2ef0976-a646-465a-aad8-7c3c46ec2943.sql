-- ============ Default permission grants ============
INSERT INTO public.role_permissions (role, permission)
SELECT 'super_admin'::public.app_role, p FROM unnest(enum_range(NULL::public.app_permission)) p
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission)
SELECT 'admin'::public.app_role, p FROM unnest(enum_range(NULL::public.app_permission)) p
WHERE p <> 'roles.write'::public.app_permission
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission) VALUES
  ('moderator','users.read'),('moderator','jobs.read'),('moderator','jobs.write'),
  ('moderator','reports.read'),('moderator','reports.write'),('moderator','reviews.read'),
  ('moderator','reviews.write'),('moderator','messages.read'),('moderator','messages.moderate'),
  ('moderator','applications.read'),('moderator','workers.read'),('moderator','employers.read'),
  ('moderator','analytics.read'),
  ('support_agent','users.read'),('support_agent','jobs.read'),('support_agent','applications.read'),
  ('support_agent','reports.read'),('support_agent','notifications.read'),('support_agent','notifications.write'),
  ('support_agent','workers.read'),('support_agent','employers.read'),('support_agent','payments.read'),
  ('verification_officer','users.read'),('verification_officer','verification.read'),
  ('verification_officer','verification.write'),('verification_officer','workers.read'),
  ('content_moderator','jobs.read'),('content_moderator','jobs.write'),('content_moderator','reviews.read'),
  ('content_moderator','reviews.write'),('content_moderator','reports.read'),('content_moderator','reports.write'),
  ('content_moderator','categories.read'),('content_moderator','messages.read'),('content_moderator','messages.moderate'),
  ('analyst','analytics.read'),('analyst','users.read'),('analyst','jobs.read'),
  ('analyst','applications.read'),('analyst','payments.read'),('analyst','reports.read')
ON CONFLICT DO NOTHING;

-- ============ Audit helper ============
CREATE OR REPLACE FUNCTION public.write_audit(_action text, _entity_type text, _entity_id text, _details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (actor_id, actor_email, action, entity_type, entity_id, details)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()), _action, _entity_type, _entity_id, COALESCE(_details,'{}'::jsonb));
END; $$;
REVOKE EXECUTE ON FUNCTION public.write_audit(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_permission(_permission public.app_permission)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), _permission) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.require_permission(public.app_permission) FROM PUBLIC, anon;

-- ============ One-time super admin bootstrap ============
CREATE OR REPLACE FUNCTION public.claim_super_admin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    RAISE EXCEPTION 'A super admin already exists' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'super_admin') ON CONFLICT DO NOTHING;
  PERFORM public.write_audit('super_admin.claimed','user', v_uid::text, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_super_admin() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.super_admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin');
$$;
REVOKE EXECUTE ON FUNCTION public.super_admin_exists() FROM PUBLIC, anon;

-- ============ Role management ============
CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role, _grant boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('roles.write');
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own roles' USING ERRCODE='42501'; END IF;
  IF _role = 'super_admin' AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can manage super admins' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='super_admin')
     AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can modify a super admin' USING ERRCODE='42501';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id=_user_id AND role=_role;
  END IF;
  PERFORM public.write_audit(CASE WHEN _grant THEN 'role.granted' ELSE 'role.revoked' END,'user',_user_id::text, jsonb_build_object('role',_role));
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role, boolean) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_set_role_permission(_role public.app_role, _permission public.app_permission, _enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can configure permissions' USING ERRCODE='42501';
  END IF;
  IF _role = 'super_admin' THEN RAISE EXCEPTION 'Super admin permissions are fixed' USING ERRCODE='42501'; END IF;
  IF _enabled THEN
    INSERT INTO public.role_permissions (role, permission) VALUES (_role,_permission) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.role_permissions WHERE role=_role AND permission=_permission;
  END IF;
  PERFORM public.write_audit('permission.updated','role',_role::text, jsonb_build_object('permission',_permission,'enabled',_enabled));
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_role_permission(public.app_role, public.app_permission, boolean) FROM PUBLIC, anon;

-- ============ Moderation ============
CREATE OR REPLACE FUNCTION public.admin_set_suspension(_user_id uuid, _suspended boolean, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('users.write');
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot suspend yourself' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('super_admin','admin'))
     AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can suspend an administrator' USING ERRCODE='42501';
  END IF;
  UPDATE public.profiles SET suspended_at = CASE WHEN _suspended THEN now() ELSE NULL END,
                             suspension_reason = CASE WHEN _suspended THEN _reason ELSE NULL END,
                             available = CASE WHEN _suspended THEN false ELSE available END
  WHERE id = _user_id;
  PERFORM public.write_audit(CASE WHEN _suspended THEN 'user.suspended' ELSE 'user.reactivated' END,'user',_user_id::text, jsonb_build_object('reason',_reason));
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_suspension(uuid, boolean, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_set_job_hidden(_job_id uuid, _hidden boolean, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('jobs.write');
  UPDATE public.jobs SET hidden_at = CASE WHEN _hidden THEN now() ELSE NULL END,
                         hidden_reason = CASE WHEN _hidden THEN _reason ELSE NULL END
  WHERE id = _job_id;
  PERFORM public.write_audit(CASE WHEN _hidden THEN 'job.hidden' ELSE 'job.restored' END,'job',_job_id::text, jsonb_build_object('reason',_reason));
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_job_hidden(uuid, boolean, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_review_verification(_id uuid, _status public.verification_status, _notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  PERFORM public.push_notification(v_user,'verification',
    CASE _status WHEN 'verified' THEN 'Your ID was verified'
                 WHEN 'rejected' THEN 'Your verification was rejected'
                 ELSE 'We need more information for your verification' END,
    _notes, '/settings');
  PERFORM public.write_audit('verification.'||_status::text,'verification_request',_id::text, jsonb_build_object('user_id',v_user,'notes',_notes));
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_review_verification(uuid, public.verification_status, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_update_report(_id uuid, _status public.report_status, _notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('reports.write');
  UPDATE public.reports SET status=_status WHERE id=_id;
  PERFORM public.write_audit('report.'||_status::text,'report',_id::text, jsonb_build_object('notes',_notes));
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_update_report(uuid, public.report_status, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_delete_review(_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('reviews.write');
  DELETE FROM public.reviews WHERE id=_id;
  PERFORM public.write_audit('review.deleted','review',_id::text, jsonb_build_object('reason',_reason));
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_review(uuid, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_upsert_category(_slug text, _name text, _icon text, _sort_order integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('categories.write');
  INSERT INTO public.categories (slug,name,icon,sort_order) VALUES (_slug,_name,COALESCE(_icon,'Wrench'),COALESCE(_sort_order,0))
  ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order;
  PERFORM public.write_audit('category.saved','category',_slug, jsonb_build_object('name',_name));
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_category(text,text,text,integer) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_delete_category(_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('categories.write');
  DELETE FROM public.categories WHERE slug=_slug;
  PERFORM public.write_audit('category.deleted','category',_slug,'{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_category(text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_send_notification(_user_id uuid, _title text, _body text, _link text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('notifications.write');
  PERFORM public.push_notification(_user_id,'admin',_title,_body,_link);
  PERFORM public.write_audit('notification.sent','user',_user_id::text, jsonb_build_object('title',_title));
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_send_notification(uuid,text,text,text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_set_setting(_key text, _value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('settings.write');
  INSERT INTO public.app_settings (key,value,updated_at,updated_by) VALUES (_key,_value,now(),auth.uid())
  ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now(), updated_by=auth.uid();
  PERFORM public.write_audit('setting.updated','setting',_key, _value);
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_setting(text,jsonb) FROM PUBLIC, anon;

-- ============ Analytics ============
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.require_permission('analytics.read');
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'verified_users', (SELECT count(*) FROM public.profiles WHERE verification='verified'),
    'suspended_users', (SELECT count(*) FROM public.profiles WHERE suspended_at IS NOT NULL),
    'workers', (SELECT count(*) FROM public.profiles WHERE is_worker),
    'employers', (SELECT count(DISTINCT employer_id) FROM public.jobs),
    'jobs_posted', (SELECT count(*) FROM public.jobs),
    'jobs_open', (SELECT count(*) FROM public.jobs WHERE status='open'),
    'jobs_completed', (SELECT count(*) FROM public.jobs WHERE status='completed'),
    'jobs_hidden', (SELECT count(*) FROM public.jobs WHERE hidden_at IS NOT NULL),
    'applications', (SELECT count(*) FROM public.job_applications),
    'messages', (SELECT count(*) FROM public.messages),
    'reports_open', (SELECT count(*) FROM public.reports WHERE status='open'),
    'reports', (SELECT count(*) FROM public.reports),
    'reviews', (SELECT count(*) FROM public.reviews),
    'verification_pending', (SELECT count(*) FROM public.verification_requests WHERE status='pending'),
    'verification_requests', (SELECT count(*) FROM public.verification_requests),
    'payments_total', (SELECT count(*) FROM public.payment_transactions),
    'payments_succeeded', (SELECT count(*) FROM public.payment_transactions WHERE status='succeeded'),
    'payments_volume_cents', (SELECT COALESCE(sum(amount_cents),0) FROM public.payment_transactions WHERE status='succeeded'),
    'dau', (SELECT count(*) FROM public.profiles WHERE last_seen_at > now() - interval '1 day'),
    'mau', (SELECT count(*) FROM public.profiles WHERE last_seen_at > now() - interval '30 days'),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'new_jobs_7d', (SELECT count(*) FROM public.jobs WHERE created_at > now() - interval '7 days'),
    'signups_trend', (SELECT COALESCE(jsonb_agg(t ORDER BY t.day),'[]'::jsonb) FROM (
        SELECT date_trunc('day', d)::date AS day,
               (SELECT count(*) FROM public.profiles p WHERE p.created_at::date = d::date) AS count
        FROM generate_series(now() - interval '13 days', now(), interval '1 day') d) t),
    'jobs_trend', (SELECT COALESCE(jsonb_agg(t ORDER BY t.day),'[]'::jsonb) FROM (
        SELECT date_trunc('day', d)::date AS day,
               (SELECT count(*) FROM public.jobs j WHERE j.created_at::date = d::date) AS count
        FROM generate_series(now() - interval '13 days', now(), interval '1 day') d) t)
  ) INTO v;
  RETURN v;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
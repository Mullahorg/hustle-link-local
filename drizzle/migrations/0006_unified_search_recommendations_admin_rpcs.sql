CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS jobs_title_trgm ON public.jobs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_title_trgm ON public.market_listings USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_name_trgm ON public.profiles USING gin (full_name gin_trgm_ops);

-- ===================== one search box for everything =====================
CREATE OR REPLACE FUNCTION public.unified_search(_q text DEFAULT '', _limit integer DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q text := nullif(btrim(coalesce(_q, '')), '');
  pattern text;
  ts tsquery;
  out jsonb;
BEGIN
  IF q IS NULL THEN
    RETURN jsonb_build_object('jobs','[]'::jsonb,'workers','[]'::jsonb,'listings','[]'::jsonb,
                              'businesses','[]'::jsonb,'categories','[]'::jsonb,'areas','[]'::jsonb);
  END IF;
  pattern := '%' || q || '%';
  ts := websearch_to_tsquery('simple', q);

  SELECT jsonb_build_object(
    'jobs', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT j.id, j.title, j.area, j.category_slug, j.budget_min, j.budget_max, j.urgent, j.created_at
        FROM public.jobs j
        WHERE j.status = 'open' AND j.hidden_at IS NULL
          AND (j.search_vector @@ ts OR j.title ILIKE pattern OR similarity(j.title, q) > 0.24)
        ORDER BY (j.search_vector @@ ts) DESC, j.urgent DESC, j.created_at DESC
        LIMIT _limit) x), '[]'::jsonb),

    'workers', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT p.id, p.full_name, p.headline, p.area, p.category_slug, p.avatar_url,
               p.rating_avg, p.rating_count, p.verification::text AS verification, p.available
        FROM public.profiles p
        WHERE p.is_worker AND p.suspended_at IS NULL
          AND (p.search_vector @@ ts OR p.full_name ILIKE pattern OR coalesce(p.headline,'') ILIKE pattern
               OR similarity(p.full_name, q) > 0.24 OR q = ANY(p.skills))
        ORDER BY (p.verification = 'verified') DESC, p.rating_avg DESC, p.rating_count DESC
        LIMIT _limit) x), '[]'::jsonb),

    'listings', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT l.id, l.title, l.area, l.price_cents, l.unit_label, l.price_note, l.images,
               l.condition, l.listing_type, l.stock_qty, l.offers_delivery, l.delivery_fee_cents,
               l.category_slug, l.created_at
        FROM public.market_listings l
        WHERE l.status = 'available' AND l.hidden_at IS NULL AND l.archived_at IS NULL
          AND (l.search_vector @@ ts OR l.title ILIKE pattern OR similarity(l.title, q) > 0.24)
        ORDER BY (l.search_vector @@ ts) DESC, l.created_at DESC
        LIMIT _limit) x), '[]'::jsonb),

    'businesses', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT b.id, b.name, b.slug, b.area, b.category_slug, b.logo_url, b.verified
        FROM public.businesses b
        WHERE b.status = 'active'
          AND (b.name ILIKE pattern OR coalesce(b.about,'') ILIKE pattern OR similarity(b.name, q) > 0.24)
        ORDER BY b.verified DESC, b.name
        LIMIT _limit) x), '[]'::jsonb),

    'categories', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT c.slug, c.name, 'job'::text AS kind FROM public.categories c
        WHERE c.name ILIKE pattern OR similarity(c.name, q) > 0.3
        UNION ALL
        SELECT m.slug, m.name, 'market'::text FROM public.market_categories m
        WHERE m.name ILIKE pattern OR similarity(m.name, q) > 0.3
        LIMIT _limit) x), '[]'::jsonb),

    'areas', coalesce((SELECT jsonb_agg(DISTINCT area) FROM (
        SELECT area FROM public.jobs WHERE area ILIKE pattern AND status = 'open'
        UNION
        SELECT area FROM public.market_listings WHERE area ILIKE pattern AND status = 'available'
        LIMIT _limit) a), '[]'::jsonb)
  ) INTO out;

  RETURN out;
END $$;

REVOKE ALL ON FUNCTION public.unified_search(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.unified_search(text, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_search(_term text, _scope text DEFAULT 'all', _results integer DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR btrim(coalesce(_term,'')) = '' THEN RETURN; END IF;
  INSERT INTO public.search_queries (user_id, term, scope, results)
  VALUES (auth.uid(), lower(btrim(_term)), coalesce(_scope,'all'), coalesce(_results,0));
END $$;

CREATE OR REPLACE FUNCTION public.trending_searches(_limit integer DEFAULT 8)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(t.term ORDER BY t.hits DESC), '[]'::jsonb)
  FROM (
    SELECT term, count(*) AS hits
    FROM public.search_queries
    WHERE created_at > now() - interval '14 days' AND length(term) > 2
    GROUP BY term
    ORDER BY hits DESC
    LIMIT _limit
  ) t
$$;
GRANT EXECUTE ON FUNCTION public.trending_searches(integer) TO anon, authenticated, service_role;

-- ===================== recommendations =====================
CREATE OR REPLACE FUNCTION public.recommended_for_me(_limit integer DEFAULT 6)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  my_area text;
  my_cat text;
  my_skills text[];
  cats text[];
  out jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('jobs','[]'::jsonb,'listings','[]'::jsonb,'reason','');
  END IF;

  SELECT area, category_slug, skills INTO my_area, my_cat, my_skills FROM public.profiles WHERE id = uid;

  SELECT array_agg(DISTINCT c) INTO cats FROM (
    SELECT l.category_slug AS c FROM public.saved_listings s
      JOIN public.market_listings l ON l.id = s.listing_id WHERE s.user_id = uid
    UNION ALL
    SELECT l.category_slug FROM public.market_orders o
      JOIN public.market_listings l ON l.id = o.listing_id WHERE o.buyer_id = uid
  ) z;

  SELECT jsonb_build_object(
    'jobs', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT j.id, j.title, j.area, j.category_slug, j.budget_min, j.budget_max, j.urgent, j.created_at,
               (CASE WHEN j.category_slug = my_cat THEN 3 ELSE 0 END)
             + (CASE WHEN j.area = my_area THEN 2 ELSE 0 END)
             + (CASE WHEN j.skills && coalesce(my_skills, '{}') THEN 2 ELSE 0 END)
             + (CASE WHEN j.urgent THEN 1 ELSE 0 END) AS score
        FROM public.jobs j
        WHERE j.status = 'open' AND j.hidden_at IS NULL AND j.employer_id <> uid
          AND NOT EXISTS (SELECT 1 FROM public.job_applications a WHERE a.job_id = j.id AND a.worker_id = uid)
        ORDER BY score DESC, j.created_at DESC
        LIMIT _limit) x), '[]'::jsonb),

    'listings', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT l.id, l.title, l.area, l.price_cents, l.unit_label, l.price_note, l.images, l.condition,
               l.listing_type, l.stock_qty, l.offers_delivery, l.delivery_fee_cents, l.category_slug,
               l.created_at, l.seller_id,
               (CASE WHEN l.area = my_area THEN 3 ELSE 0 END)
             + (CASE WHEN cats IS NOT NULL AND l.category_slug = ANY(cats) THEN 3 ELSE 0 END)
             + (CASE WHEN l.views > 20 THEN 1 ELSE 0 END) AS score
        FROM public.market_listings l
        WHERE l.status = 'available' AND l.hidden_at IS NULL AND l.archived_at IS NULL AND l.seller_id <> uid
        ORDER BY score DESC, l.created_at DESC
        LIMIT _limit) x), '[]'::jsonb),
    'reason', coalesce(my_area, 'your area')
  ) INTO out;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.recommended_for_me(integer) TO authenticated, service_role;

-- ===================== storage lifecycle =====================
CREATE OR REPLACE FUNCTION public.archive_listing(_id uuid, _archive boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT seller_id INTO owner FROM public.market_listings WHERE id = _id;
  IF owner IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF owner <> auth.uid() AND NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.market_orders o WHERE o.listing_id = _id AND o.status = 'held') THEN
    RAISE EXCEPTION 'This item has an order in progress';
  END IF;
  UPDATE public.market_listings
     SET archived_at = CASE WHEN _archive THEN now() ELSE NULL END,
         status = CASE WHEN _archive THEN 'archived' ELSE 'available' END
   WHERE id = _id;
  PERFORM public.emit_event(CASE WHEN _archive THEN 'listing.archived' ELSE 'listing.restored' END,
                            'listing', _id::text, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.archive_listing(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_storage_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.require_permission('settings.read');
  SELECT jsonb_build_object(
    'listings_total', (SELECT count(*) FROM public.market_listings),
    'listings_active', (SELECT count(*) FROM public.market_listings WHERE status = 'available' AND archived_at IS NULL),
    'listings_sold', (SELECT count(*) FROM public.market_listings WHERE status = 'sold'),
    'listings_archived', (SELECT count(*) FROM public.market_listings WHERE archived_at IS NOT NULL),
    'stale_listings', (SELECT count(*) FROM public.market_listings
                        WHERE archived_at IS NULL AND updated_at < now() - interval '90 days'),
    'photos', (SELECT coalesce(sum(cardinality(images)), 0) FROM public.market_listings),
    'photos_archived', (SELECT coalesce(sum(cardinality(images)), 0) FROM public.market_listings WHERE archived_at IS NOT NULL),
    'verification_docs', (SELECT count(*) FROM public.verification_requests WHERE front_path IS NOT NULL),
    'portfolio_items', (SELECT count(*) FROM public.portfolio_items)
  ) INTO out;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.admin_archive_stale_listings(_days integer DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  PERFORM public.require_permission('settings.write');
  WITH moved AS (
    UPDATE public.market_listings
       SET archived_at = now(), status = 'archived'
     WHERE archived_at IS NULL
       AND status <> 'available'
       AND updated_at < now() - make_interval(days => greatest(_days, 30))
       AND NOT EXISTS (SELECT 1 FROM public.market_orders o WHERE o.listing_id = market_listings.id AND o.status = 'held')
       AND NOT EXISTS (SELECT 1 FROM public.disputes d JOIN public.market_orders o2 ON o2.id = d.order_id
                        WHERE o2.listing_id = market_listings.id AND d.status = 'open')
    RETURNING 1)
  SELECT count(*) INTO n FROM moved;
  PERFORM public.write_audit('storage.archive_stale', 'market_listings', NULL, jsonb_build_object('count', n, 'days', _days));
  RETURN jsonb_build_object('ok', true, 'archived', n);
END $$;

-- ===================== admin: orders, businesses, health, fraud =====================
CREATE OR REPLACE FUNCTION public.admin_orders(_status text DEFAULT 'all', _limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.require_permission('payments.read');
  SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO out FROM (
    SELECT o.id, o.listing_id, o.title, o.amount_cents, o.status, o.fulfilment, o.fulfilment_status,
           o.quantity, o.created_at, o.completed_at,
           b.full_name AS buyer_name, s.full_name AS seller_name
    FROM public.market_orders o
    LEFT JOIN public.profiles b ON b.id = o.buyer_id
    LEFT JOIN public.profiles s ON s.id = o.seller_id
    WHERE _status = 'all' OR o.status = _status
    ORDER BY o.created_at DESC
    LIMIT _limit) x;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.admin_businesses(_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.require_permission('users.read');
  SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO out FROM (
    SELECT b.id, b.name, b.slug, b.area, b.category_slug, b.verified, b.status, b.registration_no,
           b.created_at, p.full_name AS owner_name,
           (SELECT count(*) FROM public.business_members m WHERE m.business_id = b.id) AS members,
           (SELECT count(*) FROM public.market_listings l WHERE l.business_id = b.id) AS listings
    FROM public.businesses b
    LEFT JOIN public.profiles p ON p.id = b.owner_id
    ORDER BY b.created_at DESC
    LIMIT _limit) x;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_business_verified(_id uuid, _verified boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('users.write');
  UPDATE public.businesses SET verified = _verified WHERE id = _id;
  PERFORM public.write_audit('business.verified', 'business', _id::text, jsonb_build_object('verified', _verified));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.system_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.require_permission('settings.read');
  SELECT jsonb_build_object(
    'db_size', pg_size_pretty(pg_database_size(current_database())),
    'tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
    'events_24h', (SELECT count(*) FROM public.platform_events WHERE created_at > now() - interval '24 hours'),
    'errors_webhooks_24h', (SELECT count(*) FROM public.payment_webhook_events
                             WHERE created_at > now() - interval '24 hours' AND error IS NOT NULL),
    'payments_pending', (SELECT count(*) FROM public.payment_transactions WHERE status = 'pending'),
    'payments_failed_24h', (SELECT count(*) FROM public.payment_transactions
                             WHERE status = 'failed' AND created_at > now() - interval '24 hours'),
    'open_disputes', (SELECT count(*) FROM public.disputes WHERE status = 'open'),
    'held_orders', (SELECT count(*) FROM public.market_orders WHERE status = 'held'),
    'held_escrows', (SELECT count(*) FROM public.job_escrows WHERE status NOT IN ('released','refunded','cancelled')),
    'ledger_entries', (SELECT count(*) FROM public.wallet_ledger),
    'pending_verifications', (SELECT count(*) FROM public.verification_requests WHERE status = 'pending'),
    'active_users_24h', (SELECT count(*) FROM public.profiles WHERE last_seen_at > now() - interval '24 hours'),
    'checked_at', now()
  ) INTO out;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.fraud_signals()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.require_permission('reports.read');
  SELECT jsonb_build_object(
    'repeat_disputes', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT d.against_id AS user_id, p.full_name, count(*) AS disputes
        FROM public.disputes d LEFT JOIN public.profiles p ON p.id = d.against_id
        WHERE d.created_at > now() - interval '60 days'
        GROUP BY d.against_id, p.full_name HAVING count(*) >= 2
        ORDER BY count(*) DESC LIMIT 20) x), '[]'::jsonb),
    'bulk_listers', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT l.seller_id AS user_id, p.full_name, count(*) AS listings, p.verification::text AS verification
        FROM public.market_listings l LEFT JOIN public.profiles p ON p.id = l.seller_id
        WHERE l.created_at > now() - interval '24 hours'
        GROUP BY l.seller_id, p.full_name, p.verification HAVING count(*) >= 5
        ORDER BY count(*) DESC LIMIT 20) x), '[]'::jsonb),
    'reported_users', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT r.subject_user_id AS user_id, p.full_name, count(*) AS reports
        FROM public.reports r LEFT JOIN public.profiles p ON p.id = r.subject_user_id
        WHERE r.status = 'open' AND r.subject_user_id IS NOT NULL
        GROUP BY r.subject_user_id, p.full_name HAVING count(*) >= 2
        ORDER BY count(*) DESC LIMIT 20) x), '[]'::jsonb),
    'failed_payments', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT t.user_id, p.full_name, count(*) AS failures
        FROM public.payment_transactions t LEFT JOIN public.profiles p ON p.id = t.user_id
        WHERE t.status = 'failed' AND t.created_at > now() - interval '7 days'
        GROUP BY t.user_id, p.full_name HAVING count(*) >= 3
        ORDER BY count(*) DESC LIMIT 20) x), '[]'::jsonb)
  ) INTO out;
  RETURN out;
END $$;
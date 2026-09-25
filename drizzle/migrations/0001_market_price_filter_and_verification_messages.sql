CREATE OR REPLACE FUNCTION public.search_listings_priced(_q text DEFAULT '', _category text DEFAULT '', _area text DEFAULT '', _min_cents integer DEFAULT NULL, _max_cents integer DEFAULT NULL, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS TABLE(id uuid, title text, description text, category_slug text, condition text, price_cents integer, price_note text, unit_label text, area text, images text[], status text, views integer, created_at timestamptz, seller_id uuid, seller_name text, seller_avatar text, seller_verification verification_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT l.id, l.title, l.description, l.category_slug, l.condition,
         l.price_cents, l.price_note, l.unit_label, l.area, l.images,
         l.status, l.views, l.created_at, l.seller_id, p.full_name, p.avatar_url, p.verification
  FROM public.market_listings l JOIN public.profiles p ON p.id = l.seller_id
  WHERE l.hidden_at IS NULL AND l.status = 'available'
    AND (_category IS NULL OR _category = '' OR l.category_slug = _category)
    AND (_area IS NULL OR _area = '' OR l.area ILIKE '%' || _area || '%')
    AND (_q IS NULL OR _q = '' OR l.search_vector @@ plainto_tsquery('simple', _q) OR l.title ILIKE '%' || _q || '%')
    AND (_min_cents IS NULL OR l.price_cents >= _min_cents)
    AND (_max_cents IS NULL OR l.price_cents <= _max_cents)
  ORDER BY l.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit,20), 50)) OFFSET greatest(0, coalesce(_offset,0));
$$;
GRANT EXECUTE ON FUNCTION public.search_listings_priced(text,text,text,integer,integer,integer,integer) TO anon, authenticated;
CREATE INDEX IF NOT EXISTS market_listings_price_idx ON public.market_listings(price_cents) WHERE status='available' AND hidden_at IS NULL;

CREATE OR REPLACE FUNCTION public.admin_review_verification(_id uuid, _status verification_status, _notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_user uuid; v_title text; v_body text; v_reason text := NULLIF(trim(coalesce(_notes,'')),'');
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

  IF _status = 'verified' THEN
    v_title := 'Your ID is verified';
    v_body := 'You can now apply for jobs and your profile shows the verified badge.'
      || CASE WHEN v_reason IS NOT NULL THEN ' Note from our team: '||v_reason ELSE '' END;
  ELSIF _status = 'rejected' THEN
    v_title := 'Your verification was not approved';
    v_body := 'Reason: '||coalesce(v_reason,'Your documents did not meet our checks.')
      || ' Next step: contact support from Settings if you think this is a mistake.';
  ELSE
    v_title := 'Please send new ID photos';
    v_body := 'Reason: '||coalesce(v_reason,'We could not read your photos clearly.')
      || ' Next step: open Verify my ID and take new, clear photos in good light.';
  END IF;
  PERFORM public.push_notification(v_user,'verification',v_title,v_body,'/verify');
  PERFORM public.write_audit('verification.'||_status::text,'verification_request',_id::text, jsonb_build_object('user_id',v_user,'notes',_notes));
  RETURN jsonb_build_object('ok', true, 'user_id', v_user, 'title', v_title, 'body', v_body);
END; $function$;
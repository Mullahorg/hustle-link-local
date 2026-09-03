
-- ============ market categories ============
CREATE TABLE public.market_categories (
  slug text PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'Package',
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.market_categories TO anon, authenticated;
GRANT ALL ON public.market_categories TO service_role;
ALTER TABLE public.market_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Market categories are public" ON public.market_categories FOR SELECT USING (true);

INSERT INTO public.market_categories (slug, name, icon, sort_order) VALUES
  ('farm-produce','Farm produce','Wheat',1),
  ('livestock','Livestock','Beef',2),
  ('food-drinks','Food & drinks','Utensils',3),
  ('household','Household items','Home',4),
  ('furniture','Furniture','Armchair',5),
  ('electronics','Electronics','Tv',6),
  ('phones','Phones','Smartphone',7),
  ('clothes','Clothes & shoes','Shirt',8),
  ('building','Building materials','Hammer',9),
  ('tools','Tools & machines','Wrench',10),
  ('transport','Bikes & vehicles','Bike',11),
  ('land-rentals','Land & rentals','MapPin',12),
  ('services','Services','HandHelping',13),
  ('other','Other','Package',14);

-- ============ listings ============
CREATE TABLE public.market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category_slug text NOT NULL REFERENCES public.market_categories(slug),
  condition text NOT NULL DEFAULT 'used',
  price_cents integer,
  price_note text,
  unit_label text,
  area text NOT NULL,
  phone text,
  images text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'available',
  views integer NOT NULL DEFAULT 0,
  hidden_at timestamptz,
  hidden_reason text,
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_listings_status_chk CHECK (status IN ('available','sold')),
  CONSTRAINT market_listings_condition_chk CHECK (condition IN ('new','used','refurbished'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_listings TO authenticated;
GRANT SELECT ON public.market_listings TO anon;
GRANT ALL ON public.market_listings TO service_role;
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible listings are public" ON public.market_listings
  FOR SELECT USING (hidden_at IS NULL);
CREATE POLICY "Sellers see their own listings" ON public.market_listings
  FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Sellers create their own listings" ON public.market_listings
  FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "Sellers update their own listings" ON public.market_listings
  FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY "Sellers delete their own listings" ON public.market_listings
  FOR DELETE TO authenticated USING (seller_id = auth.uid());

CREATE OR REPLACE FUNCTION public.market_listing_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  NEW.search_vector =
    setweight(to_tsvector('simple', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.area,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description,'')), 'C');
  RETURN NEW;
END; $$;
CREATE TRIGGER market_listings_touch BEFORE INSERT OR UPDATE ON public.market_listings
  FOR EACH ROW EXECUTE FUNCTION public.market_listing_touch();

CREATE INDEX market_listings_search_idx ON public.market_listings USING gin (search_vector);
CREATE INDEX market_listings_browse_idx ON public.market_listings (status, created_at DESC) WHERE hidden_at IS NULL;
CREATE INDEX market_listings_seller_idx ON public.market_listings (seller_id, created_at DESC);
CREATE INDEX market_listings_category_idx ON public.market_listings (category_slug);

-- ============ saved listings ============
CREATE TABLE public.saved_listings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.market_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_listings TO authenticated;
GRANT ALL ON public.saved_listings TO service_role;
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "People manage their own saved listings" ON public.saved_listings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ search ============
CREATE OR REPLACE FUNCTION public.search_listings(
  _q text DEFAULT NULL, _category text DEFAULT NULL, _area text DEFAULT NULL,
  _limit integer DEFAULT 20, _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, title text, description text, category_slug text, condition text,
  price_cents integer, price_note text, unit_label text, area text, images text[],
  status text, views integer, created_at timestamptz,
  seller_id uuid, seller_name text, seller_avatar text, seller_verification verification_status
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.title, l.description, l.category_slug, l.condition,
         l.price_cents, l.price_note, l.unit_label, l.area, l.images,
         l.status, l.views, l.created_at,
         l.seller_id, p.full_name, p.avatar_url, p.verification
  FROM public.market_listings l
  JOIN public.profiles p ON p.id = l.seller_id
  WHERE l.hidden_at IS NULL
    AND l.status = 'available'
    AND (_category IS NULL OR _category = '' OR l.category_slug = _category)
    AND (_area IS NULL OR _area = '' OR l.area ILIKE '%' || _area || '%')
    AND (_q IS NULL OR _q = '' OR l.search_vector @@ plainto_tsquery('simple', _q) OR l.title ILIKE '%' || _q || '%')
  ORDER BY l.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit,20), 50)) OFFSET greatest(0, coalesce(_offset,0));
$$;

CREATE OR REPLACE FUNCTION public.market_listing_detail(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'listing', to_jsonb(l) - 'search_vector',
    'seller', jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
      'area', p.area, 'verification', p.verification, 'rating_avg', p.rating_avg,
      'rating_count', p.rating_count, 'last_seen_at', p.last_seen_at,
      'listings_count', (SELECT count(*) FROM public.market_listings x WHERE x.seller_id = p.id AND x.hidden_at IS NULL)
    )
  )
  FROM public.market_listings l
  JOIN public.profiles p ON p.id = l.seller_id
  WHERE l.id = _id AND l.hidden_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.market_listing_view(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.market_listings SET views = views + 1 WHERE id = _id AND hidden_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.search_listings(text,text,text,integer,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.market_listing_detail(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.market_listing_view(uuid) TO anon, authenticated;

-- ============ moderation ============
CREATE OR REPLACE FUNCTION public.admin_set_listing_hidden(_listing_id uuid, _hidden boolean, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('jobs.write');
  UPDATE public.market_listings
     SET hidden_at = CASE WHEN _hidden THEN now() ELSE NULL END,
         hidden_reason = CASE WHEN _hidden THEN _reason ELSE NULL END
   WHERE id = _listing_id;
  PERFORM public.write_audit(CASE WHEN _hidden THEN 'listing.hidden' ELSE 'listing.restored' END,
                             'market_listing', _listing_id::text, jsonb_build_object('reason', _reason));
  RETURN jsonb_build_object('ok', true);
END; $$;

-- ============ harden first-admin claim ============
CREATE OR REPLACE FUNCTION public.claim_super_admin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_first uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    RAISE EXCEPTION 'A super admin already exists' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_first FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF v_first IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the first registered account can claim admin' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'super_admin') ON CONFLICT DO NOTHING;
  PERFORM public.write_audit('super_admin.claimed','user', v_uid::text, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END; $$;

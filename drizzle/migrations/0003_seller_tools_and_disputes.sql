-- Seller tools: listing kinds, stock, SKU, options, delivery, negotiable prices
ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS stock_qty integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS variants text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS negotiable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offers_pickup boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS offers_delivery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_note text;
ALTER TABLE public.market_listings
  ADD CONSTRAINT market_listings_type_chk CHECK (listing_type IN ('product','service','business','rental','digital')),
  ADD CONSTRAINT market_listings_stock_chk CHECK (stock_qty IS NULL OR stock_qty >= 0),
  ADD CONSTRAINT market_listings_fee_chk CHECK (delivery_fee_cents >= 0),
  ADD CONSTRAINT market_listings_fulfil_chk CHECK (offers_pickup OR offers_delivery);
CREATE INDEX IF NOT EXISTS market_listings_seller_idx ON public.market_listings(seller_id, created_at DESC);

ALTER TABLE public.market_orders
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS variant text,
  ADD COLUMN IF NOT EXISTS fulfilment text NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fulfilment_status text NOT NULL DEFAULT 'placed',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.market_orders
  ADD CONSTRAINT market_orders_fulfilment_chk CHECK (fulfilment IN ('pickup','delivery')),
  ADD CONSTRAINT market_orders_fstatus_chk CHECK (fulfilment_status IN ('placed','ready','on_the_way','delivered')),
  ADD CONSTRAINT market_orders_qty_chk CHECK (quantity > 0);
-- Items with stock can now have several open orders at once
DROP INDEX IF EXISTS public.market_orders_one_open_per_listing;
CREATE INDEX IF NOT EXISTS market_orders_listing_idx ON public.market_orders(listing_id, created_at DESC);

-- Internal money moves, never callable by clients directly
CREATE OR REPLACE FUNCTION public.market_release_internal(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_o public.market_orders; v_entry uuid;
BEGIN
  SELECT * INTO v_o FROM public.market_orders WHERE id=_order_id FOR UPDATE;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_o.status <> 'held' THEN RAISE EXCEPTION 'This order is already %', v_o.status; END IF;
  UPDATE public.market_orders SET status='released', completed_at=now(), updated_at=now() WHERE id=v_o.id;
  v_entry := public.post_ledger(v_o.buyer_id,'market_release','credit','held',v_o.amount_cents,'Released to seller for "'||v_o.title||'"',NULL,NULL,v_o.seller_id);
  UPDATE public.wallet_ledger SET order_id=v_o.id WHERE id=v_entry;
  UPDATE public.wallet_ledger SET status='cancelled' WHERE order_id=v_o.id AND user_id=v_o.seller_id AND entry_type='market_incoming' AND status='pending';
  v_entry := public.post_ledger(v_o.seller_id,'market_sale','credit','settled',v_o.amount_cents,'Sold "'||v_o.title||'"',NULL,NULL,v_o.buyer_id);
  UPDATE public.wallet_ledger SET order_id=v_o.id WHERE id=v_entry;
  PERFORM public.push_notification(v_o.seller_id,'payment','You have been paid',
    'The payment for "'||v_o.title||'" is now in your wallet.','/wallet');
END; $$;

CREATE OR REPLACE FUNCTION public.market_refund_internal(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_o public.market_orders; v_entry uuid;
BEGIN
  SELECT * INTO v_o FROM public.market_orders WHERE id=_order_id FOR UPDATE;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_o.status <> 'held' THEN RAISE EXCEPTION 'This order is already %', v_o.status; END IF;
  UPDATE public.market_orders SET status='refunded', completed_at=now(), updated_at=now() WHERE id=v_o.id;
  UPDATE public.market_listings
     SET stock_qty = CASE WHEN stock_qty IS NULL THEN NULL ELSE stock_qty + v_o.quantity END,
         status = CASE WHEN status='sold' THEN 'available' ELSE status END
   WHERE id=v_o.listing_id;
  v_entry := public.post_ledger(v_o.buyer_id,'market_release','credit','held',v_o.amount_cents,'Hold ended for "'||v_o.title||'"',NULL,NULL,v_o.seller_id);
  UPDATE public.wallet_ledger SET order_id=v_o.id WHERE id=v_entry;
  v_entry := public.post_ledger(v_o.buyer_id,'refund','credit','settled',v_o.amount_cents,'Refund for "'||v_o.title||'"',NULL,NULL,v_o.seller_id);
  UPDATE public.wallet_ledger SET order_id=v_o.id WHERE id=v_entry;
  UPDATE public.wallet_ledger SET status='cancelled' WHERE order_id=v_o.id AND user_id=v_o.seller_id AND entry_type='market_incoming' AND status='pending';
END; $$;
REVOKE ALL ON FUNCTION public.market_release_internal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_refund_internal(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.market_place_order(_listing_id uuid, _quantity integer DEFAULT 1, _variant text DEFAULT NULL, _fulfilment text DEFAULT 'pickup', _address text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_l public.market_listings; v_order uuid; v_entry uuid; v_fee integer := 0; v_total integer; v_title text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 100 THEN RAISE EXCEPTION 'Choose between 1 and 100'; END IF;
  SELECT * INTO v_l FROM public.market_listings WHERE id=_listing_id FOR UPDATE;
  IF v_l.id IS NULL OR v_l.hidden_at IS NOT NULL THEN RAISE EXCEPTION 'This item is no longer available'; END IF;
  IF v_l.seller_id = v_uid THEN RAISE EXCEPTION 'You cannot buy your own item'; END IF;
  IF v_l.status <> 'available' THEN RAISE EXCEPTION 'This item has already been sold'; END IF;
  IF v_l.price_cents IS NULL OR v_l.price_cents <= 0 THEN RAISE EXCEPTION 'This item has no fixed price. Message the seller'; END IF;
  IF v_l.stock_qty IS NOT NULL AND v_l.stock_qty < _quantity THEN
    RAISE EXCEPTION 'Only % left', v_l.stock_qty; END IF;
  IF cardinality(v_l.variants) > 0 AND (_variant IS NULL OR NOT (_variant = ANY(v_l.variants))) THEN
    RAISE EXCEPTION 'Pick one of the options first'; END IF;
  IF _fulfilment = 'delivery' THEN
    IF NOT v_l.offers_delivery THEN RAISE EXCEPTION 'This seller does not deliver'; END IF;
    IF coalesce(length(trim(_address)),0) < 4 THEN RAISE EXCEPTION 'Tell the seller where to deliver'; END IF;
    v_fee := v_l.delivery_fee_cents;
  ELSIF _fulfilment = 'pickup' THEN
    IF NOT v_l.offers_pickup THEN RAISE EXCEPTION 'This seller only delivers'; END IF;
  ELSE RAISE EXCEPTION 'Choose pickup or delivery'; END IF;

  v_total := v_l.price_cents * _quantity + v_fee;
  IF public.wallet_available_cents(v_uid) < v_total THEN RAISE EXCEPTION 'Top up your wallet first. You need %', 'KSh '||to_char(v_total/100,'FM999,999,990'); END IF;
  v_title := v_l.title || CASE WHEN _variant IS NOT NULL THEN ' ('||_variant||')' ELSE '' END || CASE WHEN _quantity > 1 THEN ' x'||_quantity ELSE '' END;

  INSERT INTO public.market_orders(listing_id,buyer_id,seller_id,title,amount_cents,quantity,variant,fulfilment,delivery_address,delivery_fee_cents)
  VALUES (v_l.id,v_uid,v_l.seller_id,v_title,v_total,_quantity,_variant,_fulfilment,nullif(trim(_address),''),v_fee) RETURNING id INTO v_order;

  UPDATE public.market_listings
     SET stock_qty = CASE WHEN stock_qty IS NULL THEN NULL ELSE stock_qty - _quantity END,
         status = CASE WHEN stock_qty IS NOT NULL AND stock_qty - _quantity <= 0 THEN 'sold' ELSE status END
   WHERE id=v_l.id;

  v_entry := public.post_ledger(v_uid,'market_purchase','debit','settled',v_total,'Bought "'||v_title||'"',NULL,NULL,v_l.seller_id);
  UPDATE public.wallet_ledger SET order_id=v_order WHERE id=v_entry;
  v_entry := public.post_ledger(v_uid,'market_hold','debit','held',v_total,'Held safely for "'||v_title||'"',NULL,NULL,v_l.seller_id);
  UPDATE public.wallet_ledger SET order_id=v_order WHERE id=v_entry;
  v_entry := public.post_ledger(v_l.seller_id,'market_incoming','credit','pending',v_total,'Sale of "'||v_title||'", paid, waiting for buyer',NULL,NULL,v_uid);
  UPDATE public.wallet_ledger SET order_id=v_order WHERE id=v_entry;

  PERFORM public.push_notification(v_l.seller_id,'payment','New order',
    'Someone paid for "'||v_title||'"'||CASE WHEN _fulfilment='delivery' THEN ' and wants it delivered.' ELSE ' and will pick it up.' END||' Open your seller dashboard.','/market/seller');
  RETURN jsonb_build_object('ok',true,'order_id',v_order);
END; $$;

CREATE OR REPLACE FUNCTION public.market_buy(_listing_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.market_place_order(_listing_id, 1, NULL, 'pickup', NULL);
$$;

CREATE OR REPLACE FUNCTION public.market_confirm_received(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_o public.market_orders;
BEGIN
  SELECT * INTO v_o FROM public.market_orders WHERE id=_order_id;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Only the buyer can confirm' USING ERRCODE='42501'; END IF;
  PERFORM public.market_release_internal(_order_id);
  UPDATE public.market_orders SET fulfilment_status='delivered' WHERE id=_order_id;
  UPDATE public.disputes SET status='resolved_release', resolution_note='Buyer confirmed they received the item', resolved_at=now()
   WHERE order_id=_order_id AND status='open';
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.market_cancel_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_o public.market_orders;
BEGIN
  SELECT * INTO v_o FROM public.market_orders WHERE id=_order_id;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_uid NOT IN (v_o.buyer_id, v_o.seller_id) THEN RAISE EXCEPTION 'Not your order' USING ERRCODE='42501'; END IF;
  IF v_uid = v_o.buyer_id AND v_o.fulfilment_status <> 'placed' THEN
    RAISE EXCEPTION 'The seller has already prepared this order. Ask them to cancel, or report a problem'; END IF;
  PERFORM public.market_refund_internal(_order_id);
  UPDATE public.disputes SET status='resolved_refund', resolution_note='Order cancelled and refunded', resolved_at=now()
   WHERE order_id=_order_id AND status='open';
  PERFORM public.push_notification(CASE WHEN v_uid=v_o.buyer_id THEN v_o.seller_id ELSE v_o.buyer_id END,'payment','Order cancelled',
    'The order for "'||v_o.title||'" was cancelled and the buyer refunded.','/wallet');
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.market_set_fulfilment(_order_id uuid, _status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_o public.market_orders; v_msg text;
BEGIN
  SELECT * INTO v_o FROM public.market_orders WHERE id=_order_id FOR UPDATE;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_o.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Only the seller can update this order' USING ERRCODE='42501'; END IF;
  IF v_o.status <> 'held' THEN RAISE EXCEPTION 'This order is already %', v_o.status; END IF;
  IF _status NOT IN ('ready','on_the_way','delivered') THEN RAISE EXCEPTION 'Unknown step'; END IF;
  UPDATE public.market_orders SET fulfilment_status=_status, updated_at=now() WHERE id=_order_id;
  v_msg := CASE _status
    WHEN 'ready' THEN 'Your order "'||v_o.title||'" is ready'||CASE WHEN v_o.fulfilment='pickup' THEN ' to pick up.' ELSE ' and will leave soon.' END
    WHEN 'on_the_way' THEN 'Your order "'||v_o.title||'" is on the way.'
    ELSE 'The seller says "'||v_o.title||'" was handed over. Check it, then confirm so they get paid.' END;
  PERFORM public.push_notification(v_o.buyer_id,'order','Order update',v_msg,'/market/'||v_o.listing_id);
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.seller_dashboard()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'open_orders', (SELECT count(*) FROM public.market_orders WHERE seller_id=auth.uid() AND status='held'),
    'pending_cents', (SELECT coalesce(sum(amount_cents),0) FROM public.market_orders WHERE seller_id=auth.uid() AND status='held'),
    'sales_30d_cents', (SELECT coalesce(sum(amount_cents),0) FROM public.market_orders WHERE seller_id=auth.uid() AND status='released' AND completed_at > now() - interval '30 days'),
    'sales_30d_count', (SELECT count(*) FROM public.market_orders WHERE seller_id=auth.uid() AND status='released' AND completed_at > now() - interval '30 days'),
    'active_items', (SELECT count(*) FROM public.market_listings WHERE seller_id=auth.uid() AND status='available' AND hidden_at IS NULL),
    'low_stock', (SELECT count(*) FROM public.market_listings WHERE seller_id=auth.uid() AND status='available' AND stock_qty IS NOT NULL AND stock_qty <= 2),
    'views_total', (SELECT coalesce(sum(views),0) FROM public.market_listings WHERE seller_id=auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.seller_dashboard() FROM anon;

-- Disputes on held money (market orders and job escrow)
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('order','job')),
  order_id uuid REFERENCES public.market_orders(id),
  job_id uuid REFERENCES public.jobs(id),
  opened_by uuid NOT NULL,
  against_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved_refund','resolved_release','closed','withdrawn')),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind='order' AND order_id IS NOT NULL) OR (kind='job' AND job_id IS NOT NULL))
);
GRANT SELECT ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties and finance staff see disputes" ON public.disputes FOR SELECT TO authenticated
  USING (auth.uid() = opened_by OR auth.uid() = against_id OR public.has_permission(auth.uid(),'payments.read'));
CREATE UNIQUE INDEX disputes_one_open_order ON public.disputes(order_id) WHERE status='open';
CREATE UNIQUE INDEX disputes_one_open_job ON public.disputes(job_id) WHERE status='open';
CREATE INDEX disputes_status_idx ON public.disputes(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.open_dispute(_order_id uuid, _job_id uuid, _reason text, _details text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_o public.market_orders; v_e public.job_escrows; v_against uuid; v_id uuid; v_title text; v_link text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
  IF coalesce(length(trim(_reason)),0) < 3 THEN RAISE EXCEPTION 'Tell us what went wrong'; END IF;
  IF _order_id IS NOT NULL THEN
    SELECT * INTO v_o FROM public.market_orders WHERE id=_order_id;
    IF v_o.id IS NULL OR v_uid NOT IN (v_o.buyer_id, v_o.seller_id) THEN RAISE EXCEPTION 'Not your order' USING ERRCODE='42501'; END IF;
    IF v_o.status <> 'held' THEN RAISE EXCEPTION 'This payment is already settled'; END IF;
    v_against := CASE WHEN v_uid=v_o.buyer_id THEN v_o.seller_id ELSE v_o.buyer_id END;
    v_title := v_o.title; v_link := '/market/'||v_o.listing_id;
    INSERT INTO public.disputes(kind,order_id,opened_by,against_id,reason,details)
    VALUES ('order',_order_id,v_uid,v_against,trim(_reason),nullif(trim(_details),'')) RETURNING id INTO v_id;
  ELSIF _job_id IS NOT NULL THEN
    SELECT * INTO v_e FROM public.job_escrows WHERE job_id=_job_id;
    IF v_e.id IS NULL OR v_uid NOT IN (v_e.employer_id, coalesce(v_e.worker_id, v_e.employer_id)) THEN RAISE EXCEPTION 'Not your job' USING ERRCODE='42501'; END IF;
    IF v_e.status NOT IN ('secured','in_progress','awaiting_confirmation') THEN RAISE EXCEPTION 'This payment is already settled'; END IF;
    IF v_e.worker_id IS NULL THEN RAISE EXCEPTION 'No worker is hired yet'; END IF;
    v_against := CASE WHEN v_uid=v_e.employer_id THEN v_e.worker_id ELSE v_e.employer_id END;
    SELECT title INTO v_title FROM public.jobs WHERE id=_job_id; v_link := '/jobs/'||_job_id;
    INSERT INTO public.disputes(kind,job_id,opened_by,against_id,reason,details)
    VALUES ('job',_job_id,v_uid,v_against,trim(_reason),nullif(trim(_details),'')) RETURNING id INTO v_id;
  ELSE RAISE EXCEPTION 'Nothing to report';
  END IF;
  PERFORM public.push_notification(v_against,'payment','A problem was reported',
    'The other person reported a problem with "'||v_title||'". The money stays held while our team looks into it.', v_link);
  RETURN jsonb_build_object('ok',true,'id',v_id);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'A problem is already reported for this payment';
END; $$;

CREATE OR REPLACE FUNCTION public.withdraw_dispute(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.disputes SET status='withdrawn', resolved_at=now() WHERE id=_id AND opened_by=auth.uid() AND status='open';
  IF NOT FOUND THEN RAISE EXCEPTION 'Nothing to withdraw'; END IF;
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_id uuid, _outcome text, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_d public.disputes; v_e public.job_escrows; v_title text; v_status text;
BEGIN
  PERFORM public.require_permission('payments.write');
  IF coalesce(length(trim(_note)),0) < 3 THEN RAISE EXCEPTION 'Write a short note explaining the decision'; END IF;
  SELECT * INTO v_d FROM public.disputes WHERE id=_id FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  IF v_d.status <> 'open' THEN RAISE EXCEPTION 'This dispute is already %', v_d.status; END IF;
  IF _outcome NOT IN ('refund','release','close') THEN RAISE EXCEPTION 'Unknown outcome'; END IF;

  IF v_d.kind='order' AND _outcome <> 'close' THEN
    IF _outcome='refund' THEN PERFORM public.market_refund_internal(v_d.order_id);
    ELSE PERFORM public.market_release_internal(v_d.order_id); END IF;
    SELECT title INTO v_title FROM public.market_orders WHERE id=v_d.order_id;
  ELSIF v_d.kind='job' AND _outcome <> 'close' THEN
    SELECT * INTO v_e FROM public.job_escrows WHERE job_id=v_d.job_id FOR UPDATE;
    SELECT title INTO v_title FROM public.jobs WHERE id=v_d.job_id;
    IF v_e.status IN ('released','refunded','cancelled') THEN RAISE EXCEPTION 'These funds were already %', v_e.status; END IF;
    IF _outcome='refund' THEN
      UPDATE public.job_escrows SET status='refunded', released_at=now() WHERE id=v_e.id;
      PERFORM public.post_ledger(v_e.employer_id,'escrow_release','credit','held',v_e.amount_cents,'Unlocked from "'||v_title||'"',NULL,v_d.job_id,v_e.worker_id);
      PERFORM public.post_ledger(v_e.employer_id,'refund','credit','settled',v_e.amount_cents,'Refund from "'||v_title||'"',NULL,v_d.job_id,v_e.worker_id);
    ELSE
      UPDATE public.job_escrows SET status='released', released_at=now() WHERE id=v_e.id;
      PERFORM public.post_ledger(v_e.employer_id,'escrow_release','credit','held',v_e.amount_cents,'Released for "'||v_title||'"',NULL,v_d.job_id,v_e.worker_id);
      PERFORM public.post_ledger(v_e.worker_id,'earning','credit','settled',v_e.amount_cents,'Payment for "'||v_title||'"',NULL,v_d.job_id,v_e.employer_id);
    END IF;
    UPDATE public.wallet_ledger SET status='cancelled'
     WHERE user_id=v_e.worker_id AND job_id=v_d.job_id AND status='pending' AND entry_type='escrow_incoming';
  END IF;

  v_status := CASE _outcome WHEN 'refund' THEN 'resolved_refund' WHEN 'release' THEN 'resolved_release' ELSE 'closed' END;
  UPDATE public.disputes SET status=v_status, resolution_note=trim(_note), resolved_by=auth.uid(), resolved_at=now() WHERE id=_id;
  PERFORM public.push_notification(v_d.opened_by,'payment','Your reported problem was decided', trim(_note), '/wallet');
  PERFORM public.push_notification(v_d.against_id,'payment','A reported problem was decided', trim(_note), '/wallet');
  PERFORM public.write_audit('dispute.'||_outcome,'dispute',_id::text,jsonb_build_object('note',trim(_note),'kind',v_d.kind));
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_disputes(_status text DEFAULT 'open')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.require_permission('payments.read');
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC) FROM (
    SELECT d.*, po.full_name AS opened_by_name, pa.full_name AS against_name,
           coalesce(o.title, j.title) AS subject_title,
           coalesce(o.amount_cents, e.amount_cents) AS amount_cents,
           coalesce(o.status, e.status::text) AS money_status,
           o.listing_id
    FROM public.disputes d
    LEFT JOIN public.profiles po ON po.id=d.opened_by
    LEFT JOIN public.profiles pa ON pa.id=d.against_id
    LEFT JOIN public.market_orders o ON o.id=d.order_id
    LEFT JOIN public.jobs j ON j.id=d.job_id
    LEFT JOIN public.job_escrows e ON e.job_id=d.job_id
    WHERE _status='all' OR d.status=_status
    LIMIT 200) x), '[]'::jsonb);
END; $$;

REVOKE ALL ON FUNCTION public.open_dispute(uuid,uuid,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.withdraw_dispute(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_disputes(text) FROM anon;
REVOKE ALL ON FUNCTION public.market_place_order(uuid,integer,text,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.market_set_fulfilment(uuid,text) FROM anon;
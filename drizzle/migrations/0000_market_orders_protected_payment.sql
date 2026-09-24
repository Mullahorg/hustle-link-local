CREATE TABLE public.market_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.market_listings(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','released','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX market_orders_buyer_idx ON public.market_orders(buyer_id, created_at DESC);
CREATE INDEX market_orders_seller_idx ON public.market_orders(seller_id, created_at DESC);
CREATE UNIQUE INDEX market_orders_one_open_per_listing ON public.market_orders(listing_id) WHERE status='held';
GRANT SELECT ON public.market_orders TO authenticated;
GRANT ALL ON public.market_orders TO service_role;
ALTER TABLE public.market_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer and seller see their orders" ON public.market_orders FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_permission(auth.uid(),'payments.read'));

ALTER TABLE public.wallet_ledger ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.market_orders(id);

CREATE OR REPLACE FUNCTION public.market_buy(_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_l public.market_listings; v_order uuid; v_entry uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_l FROM public.market_listings WHERE id=_listing_id FOR UPDATE;
  IF v_l.id IS NULL OR v_l.hidden_at IS NOT NULL THEN RAISE EXCEPTION 'This item is no longer available'; END IF;
  IF v_l.seller_id = v_uid THEN RAISE EXCEPTION 'You cannot buy your own item'; END IF;
  IF v_l.status <> 'available' THEN RAISE EXCEPTION 'This item has already been sold'; END IF;
  IF v_l.price_cents IS NULL OR v_l.price_cents <= 0 THEN RAISE EXCEPTION 'This item has no fixed price — message the seller'; END IF;
  IF public.wallet_available_cents(v_uid) < v_l.price_cents THEN RAISE EXCEPTION 'Top up your wallet first — not enough available balance'; END IF;

  INSERT INTO public.market_orders(listing_id,buyer_id,seller_id,title,amount_cents)
  VALUES (v_l.id,v_uid,v_l.seller_id,v_l.title,v_l.price_cents) RETURNING id INTO v_order;
  UPDATE public.market_listings SET status='sold' WHERE id=v_l.id;

  v_entry := public.post_ledger(v_uid,'market_purchase','debit','settled',v_l.price_cents,'Bought "'||v_l.title||'"',NULL,NULL,v_l.seller_id);
  UPDATE public.wallet_ledger SET order_id=v_order WHERE id=v_entry;
  v_entry := public.post_ledger(v_uid,'market_hold','debit','held',v_l.price_cents,'Held safely for "'||v_l.title||'"',NULL,NULL,v_l.seller_id);
  UPDATE public.wallet_ledger SET order_id=v_order WHERE id=v_entry;
  v_entry := public.post_ledger(v_l.seller_id,'market_incoming','credit','pending',v_l.price_cents,'Sale of "'||v_l.title||'" — paid, waiting for buyer',NULL,NULL,v_uid);
  UPDATE public.wallet_ledger SET order_id=v_order WHERE id=v_entry;

  PERFORM public.push_notification(v_l.seller_id,'payment','Your item was bought',
    'The buyer paid for "'||v_l.title||'". The money is held until they confirm they received it.','/market/'||v_l.id);
  RETURN jsonb_build_object('ok',true,'order_id',v_order);
END; $$;

CREATE OR REPLACE FUNCTION public.market_confirm_received(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_o public.market_orders; v_entry uuid;
BEGIN
  SELECT * INTO v_o FROM public.market_orders WHERE id=_order_id FOR UPDATE;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_o.buyer_id <> v_uid THEN RAISE EXCEPTION 'Only the buyer can confirm' USING ERRCODE='42501'; END IF;
  IF v_o.status <> 'held' THEN RAISE EXCEPTION 'This order is already %', v_o.status; END IF;
  UPDATE public.market_orders SET status='released', completed_at=now() WHERE id=v_o.id;
  v_entry := public.post_ledger(v_o.buyer_id,'market_release','credit','held',v_o.amount_cents,'Released to seller for "'||v_o.title||'"',NULL,NULL,v_o.seller_id);
  UPDATE public.wallet_ledger SET order_id=v_o.id WHERE id=v_entry;
  UPDATE public.wallet_ledger SET status='cancelled' WHERE order_id=v_o.id AND user_id=v_o.seller_id AND entry_type='market_incoming' AND status='pending';
  v_entry := public.post_ledger(v_o.seller_id,'market_sale','credit','settled',v_o.amount_cents,'Sold "'||v_o.title||'"',NULL,NULL,v_o.buyer_id);
  UPDATE public.wallet_ledger SET order_id=v_o.id WHERE id=v_entry;
  PERFORM public.push_notification(v_o.seller_id,'payment','You have been paid',
    'The buyer confirmed they received "'||v_o.title||'".','/wallet');
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.market_cancel_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_o public.market_orders; v_entry uuid;
BEGIN
  SELECT * INTO v_o FROM public.market_orders WHERE id=_order_id FOR UPDATE;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_uid NOT IN (v_o.buyer_id, v_o.seller_id) THEN RAISE EXCEPTION 'Not your order' USING ERRCODE='42501'; END IF;
  IF v_o.status <> 'held' THEN RAISE EXCEPTION 'This order is already %', v_o.status; END IF;
  UPDATE public.market_orders SET status='refunded', completed_at=now() WHERE id=v_o.id;
  UPDATE public.market_listings SET status='available' WHERE id=v_o.listing_id;
  v_entry := public.post_ledger(v_o.buyer_id,'market_release','credit','held',v_o.amount_cents,'Hold ended for "'||v_o.title||'"',NULL,NULL,v_o.seller_id);
  UPDATE public.wallet_ledger SET order_id=v_o.id WHERE id=v_entry;
  v_entry := public.post_ledger(v_o.buyer_id,'refund','credit','settled',v_o.amount_cents,'Refund for "'||v_o.title||'"',NULL,NULL,v_o.seller_id);
  UPDATE public.wallet_ledger SET order_id=v_o.id WHERE id=v_entry;
  UPDATE public.wallet_ledger SET status='cancelled' WHERE order_id=v_o.id AND user_id=v_o.seller_id AND entry_type='market_incoming' AND status='pending';
  PERFORM public.push_notification(CASE WHEN v_uid=v_o.buyer_id THEN v_o.seller_id ELSE v_o.buyer_id END,'payment','Order cancelled',
    'The order for "'||v_o.title||'" was cancelled and the buyer refunded.','/wallet');
  RETURN jsonb_build_object('ok',true);
END; $$;

REVOKE EXECUTE ON FUNCTION public.market_buy(uuid), public.market_confirm_received(uuid), public.market_cancel_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_buy(uuid), public.market_confirm_received(uuid), public.market_cancel_order(uuid) TO authenticated;
-- ============ enums ============
DO $$ BEGIN
  CREATE TYPE public.escrow_status AS ENUM
    ('awaiting_funding','secured','in_progress','awaiting_confirmation','released','refunded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_status AS ENUM ('pending','settled','held','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_direction AS ENUM ('credit','debit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ wallet ledger ============
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type text NOT NULL,
  direction public.ledger_direction NOT NULL,
  status public.ledger_status NOT NULL DEFAULT 'settled',
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'KES',
  description text NOT NULL,
  transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  counterparty_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_ledger_user_idx ON public.wallet_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_ledger_tx_idx ON public.wallet_ledger (transaction_id);
CREATE INDEX IF NOT EXISTS wallet_ledger_job_idx ON public.wallet_ledger (job_id);

GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own or staff ledger" ON public.wallet_ledger;
CREATE POLICY "own or staff ledger" ON public.wallet_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'payments.read'));

DROP TRIGGER IF EXISTS wallet_ledger_updated ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_updated BEFORE UPDATE ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ job escrow ============
CREATE TABLE IF NOT EXISTS public.job_escrows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'KES',
  status public.escrow_status NOT NULL DEFAULT 'awaiting_funding',
  funded_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_escrows_employer_idx ON public.job_escrows (employer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_escrows_worker_idx ON public.job_escrows (worker_id, created_at DESC);

GRANT SELECT ON public.job_escrows TO authenticated;
GRANT ALL ON public.job_escrows TO service_role;
ALTER TABLE public.job_escrows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parties or staff escrow" ON public.job_escrows;
CREATE POLICY "parties or staff escrow" ON public.job_escrows
  FOR SELECT TO authenticated
  USING (auth.uid() = employer_id OR auth.uid() = worker_id OR public.has_permission(auth.uid(), 'payments.read'));

DROP TRIGGER IF EXISTS job_escrows_updated ON public.job_escrows;
CREATE TRIGGER job_escrows_updated BEFORE UPDATE ON public.job_escrows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ balances, always derived ============
CREATE OR REPLACE FUNCTION public.wallet_summary(_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := COALESCE(_user_id, auth.uid()); v jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
  IF v_uid <> auth.uid() AND NOT public.has_permission(auth.uid(),'payments.read') THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501';
  END IF;

  SELECT jsonb_build_object(
    'currency','KES',
    'available_cents', COALESCE(SUM(CASE WHEN status='settled' AND direction='credit' THEN amount_cents
                                         WHEN status='settled' AND direction='debit'  THEN -amount_cents ELSE 0 END),0),
    'escrow_cents',    COALESCE(SUM(CASE WHEN status='held' AND direction='debit'  THEN amount_cents
                                         WHEN status='held' AND direction='credit' THEN -amount_cents ELSE 0 END),0),
    'pending_in_cents', COALESCE(SUM(CASE WHEN status='pending' AND direction='credit' THEN amount_cents ELSE 0 END),0),
    'pending_out_cents',COALESCE(SUM(CASE WHEN status='pending' AND direction='debit'  THEN amount_cents ELSE 0 END),0),
    'entries', (SELECT count(*) FROM public.wallet_ledger w WHERE w.user_id = v_uid)
  ) INTO v
  FROM public.wallet_ledger WHERE user_id = v_uid;

  RETURN v;
END; $$;

CREATE OR REPLACE FUNCTION public.wallet_available_cents(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::int
  FROM public.wallet_ledger WHERE user_id=_user_id AND status='settled';
$$;

CREATE OR REPLACE FUNCTION public.post_ledger(
  _user_id uuid, _type text, _direction public.ledger_direction, _status public.ledger_status,
  _amount_cents integer, _description text, _transaction_id uuid DEFAULT NULL,
  _job_id uuid DEFAULT NULL, _counterparty uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.wallet_ledger (user_id, entry_type, direction, status, amount_cents, description, transaction_id, job_id, counterparty_id)
  VALUES (_user_id,_type,_direction,_status,_amount_cents,_description,_transaction_id,_job_id,_counterparty)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- ============ top ups ============
CREATE OR REPLACE FUNCTION public.wallet_start_topup(_amount_cents integer, _phone text, _provider text DEFAULT 'payhero')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_ref text; v_tx uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
  IF _amount_cents IS NULL OR _amount_cents < 1000 THEN RAISE EXCEPTION 'Minimum top up is KSh 10'; END IF;
  IF _amount_cents > 50000000 THEN RAISE EXCEPTION 'Maximum top up is KSh 500,000'; END IF;
  IF _phone IS NULL OR _phone !~ '^(07|01|2547|2541|\+2547|\+2541)[0-9]{7,9}$' THEN
    RAISE EXCEPTION 'Enter a valid M-Pesa phone number';
  END IF;

  v_ref := 'HL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  INSERT INTO public.payment_transactions (user_id, provider, purpose, reference, amount_cents, currency, status, metadata)
  VALUES (v_uid, _provider, 'wallet_topup', v_ref, _amount_cents, 'KES', 'pending', jsonb_build_object('phone',_phone))
  RETURNING id INTO v_tx;

  PERFORM public.post_ledger(v_uid,'topup','credit','pending',_amount_cents,'Wallet top up', v_tx);
  RETURN jsonb_build_object('ok',true,'reference',v_ref,'transaction_id',v_tx);
END; $$;

CREATE OR REPLACE FUNCTION public.wallet_cancel_topup(_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_tx public.payment_transactions;
BEGIN
  SELECT * INTO v_tx FROM public.payment_transactions WHERE reference=_reference AND user_id=v_uid;
  IF v_tx.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_tx.status <> 'pending' THEN RAISE EXCEPTION 'This payment is already %', v_tx.status; END IF;
  UPDATE public.payment_transactions SET status='cancelled', failure_reason='Cancelled by user' WHERE id=v_tx.id;
  UPDATE public.wallet_ledger SET status='cancelled' WHERE transaction_id=v_tx.id AND status='pending';
  RETURN jsonb_build_object('ok',true);
END; $$;

-- Provider confirmation. Service role only (webhook) or provider poll.
CREATE OR REPLACE FUNCTION public.payment_apply_result(
  _reference text, _status text, _provider_reference text DEFAULT NULL, _failure_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tx public.payment_transactions;
BEGIN
  SELECT * INTO v_tx FROM public.payment_transactions
   WHERE reference=_reference OR provider_reference=_reference LIMIT 1;
  IF v_tx.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','unknown reference'); END IF;
  IF v_tx.status IN ('succeeded','failed','cancelled') THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,'status',v_tx.status);
  END IF;

  UPDATE public.payment_transactions
     SET status=_status, provider_reference=COALESCE(_provider_reference, provider_reference),
         failure_reason=_failure_reason, attempts=attempts+1
   WHERE id=v_tx.id;

  IF _status='succeeded' THEN
    UPDATE public.wallet_ledger SET status='settled', description='Wallet top up'
     WHERE transaction_id=v_tx.id AND status='pending';
    PERFORM public.push_notification(v_tx.user_id,'payment','Payment received',
      'Your wallet has been topped up.', '/wallet');
  ELSE
    UPDATE public.wallet_ledger SET status=CASE WHEN _status='cancelled' THEN 'cancelled'::public.ledger_status ELSE 'failed'::public.ledger_status END
     WHERE transaction_id=v_tx.id AND status='pending';
    PERFORM public.push_notification(v_tx.user_id,'payment','Payment not completed',
      COALESCE(_failure_reason,'Your top up did not go through.'), '/wallet');
  END IF;

  RETURN jsonb_build_object('ok',true,'status',_status);
END; $$;

REVOKE ALL ON FUNCTION public.payment_apply_result(text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_ledger(uuid,text,public.ledger_direction,public.ledger_status,integer,text,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;

-- ============ withdrawals ============
CREATE OR REPLACE FUNCTION public.wallet_request_withdrawal(_amount_cents integer, _phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_ref text; v_tx uuid; v_available integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
  IF _amount_cents IS NULL OR _amount_cents < 10000 THEN RAISE EXCEPTION 'Minimum withdrawal is KSh 100'; END IF;
  v_available := public.wallet_available_cents(v_uid)
    - COALESCE((SELECT SUM(amount_cents) FROM public.wallet_ledger WHERE user_id=v_uid AND status='pending' AND direction='debit'),0);
  IF _amount_cents > v_available THEN RAISE EXCEPTION 'You do not have enough available balance'; END IF;

  v_ref := 'HW-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  INSERT INTO public.payment_transactions (user_id, provider, purpose, reference, amount_cents, currency, status, metadata)
  VALUES (v_uid,'payhero','wallet_withdrawal',v_ref,_amount_cents,'KES','pending', jsonb_build_object('phone',_phone))
  RETURNING id INTO v_tx;

  PERFORM public.post_ledger(v_uid,'withdrawal','debit','pending',_amount_cents,'Withdrawal to M-Pesa', v_tx);
  RETURN jsonb_build_object('ok',true,'reference',v_ref);
END; $$;

-- ============ escrow ============
CREATE OR REPLACE FUNCTION public.escrow_fund_job(_job_id uuid, _amount_cents integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_job public.jobs; v_worker uuid; v_available integer;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id=_job_id;
  IF v_job.id IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.employer_id <> v_uid THEN RAISE EXCEPTION 'Only the employer can secure payment' USING ERRCODE='42501'; END IF;
  IF _amount_cents < 10000 THEN RAISE EXCEPTION 'Minimum amount is KSh 100'; END IF;

  SELECT worker_id INTO v_worker FROM public.job_applications
   WHERE job_id=_job_id AND status='accepted' ORDER BY updated_at DESC LIMIT 1;

  v_available := public.wallet_available_cents(v_uid);
  IF _amount_cents > v_available THEN RAISE EXCEPTION 'Top up your wallet first — not enough available balance'; END IF;

  INSERT INTO public.job_escrows (job_id, employer_id, worker_id, amount_cents, status, funded_at)
  VALUES (_job_id, v_uid, v_worker, _amount_cents, 'secured', now())
  ON CONFLICT (job_id) DO UPDATE
    SET amount_cents=EXCLUDED.amount_cents, worker_id=COALESCE(EXCLUDED.worker_id, public.job_escrows.worker_id),
        status='secured', funded_at=now();

  PERFORM public.post_ledger(v_uid,'escrow_hold','debit','settled',_amount_cents,'Payment secured for "'||v_job.title||'"',NULL,_job_id,v_worker);
  PERFORM public.post_ledger(v_uid,'escrow_hold','debit','held',_amount_cents,'Held safely for "'||v_job.title||'"',NULL,_job_id,v_worker);
  IF v_worker IS NOT NULL THEN
    PERFORM public.post_ledger(v_worker,'escrow_incoming','credit','pending',_amount_cents,'Payment secured for "'||v_job.title||'"',NULL,_job_id,v_uid);
    PERFORM public.push_notification(v_worker,'payment','Payment secured',
      'The employer has secured payment for "'||v_job.title||'".', '/jobs/'||_job_id);
  END IF;
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.escrow_set_status(_job_id uuid, _status public.escrow_status)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_e public.job_escrows;
BEGIN
  SELECT * INTO v_e FROM public.job_escrows WHERE job_id=_job_id;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'No payment secured for this job'; END IF;
  IF v_uid NOT IN (v_e.employer_id, v_e.worker_id) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501'; END IF;
  IF _status NOT IN ('in_progress','awaiting_confirmation') THEN RAISE EXCEPTION 'Unsupported update'; END IF;
  UPDATE public.job_escrows SET status=_status WHERE id=v_e.id;
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.escrow_release(_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_e public.job_escrows; v_title text;
BEGIN
  SELECT * INTO v_e FROM public.job_escrows WHERE job_id=_job_id;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'No payment secured for this job'; END IF;
  IF v_e.employer_id <> v_uid THEN RAISE EXCEPTION 'Only the employer can release funds' USING ERRCODE='42501'; END IF;
  IF v_e.status IN ('released','refunded','cancelled') THEN RAISE EXCEPTION 'These funds were already %', v_e.status; END IF;
  IF v_e.worker_id IS NULL THEN RAISE EXCEPTION 'Accept a worker before releasing funds'; END IF;
  SELECT title INTO v_title FROM public.jobs WHERE id=_job_id;

  UPDATE public.job_escrows SET status='released', released_at=now() WHERE id=v_e.id;
  PERFORM public.post_ledger(v_e.employer_id,'escrow_release','credit','held',v_e.amount_cents,'Released for "'||v_title||'"',NULL,_job_id,v_e.worker_id);
  UPDATE public.wallet_ledger SET status='cancelled'
   WHERE user_id=v_e.worker_id AND job_id=_job_id AND status='pending' AND entry_type='escrow_incoming';
  PERFORM public.post_ledger(v_e.worker_id,'earning','credit','settled',v_e.amount_cents,'Payment for "'||v_title||'"',NULL,_job_id,v_e.employer_id);
  PERFORM public.push_notification(v_e.worker_id,'payment','Funds released',
    'You have been paid for "'||v_title||'".', '/wallet');
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.escrow_refund(_job_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_e public.job_escrows; v_title text; v_staff boolean;
BEGIN
  SELECT * INTO v_e FROM public.job_escrows WHERE job_id=_job_id;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'No payment secured for this job'; END IF;
  v_staff := public.has_permission(v_uid,'payments.write');
  IF v_e.employer_id <> v_uid AND NOT v_staff THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501'; END IF;
  IF v_e.status IN ('released','refunded','cancelled') THEN RAISE EXCEPTION 'These funds were already %', v_e.status; END IF;
  IF v_e.status <> 'secured' AND NOT v_staff THEN RAISE EXCEPTION 'Work has started — contact support to unlock these funds'; END IF;
  SELECT title INTO v_title FROM public.jobs WHERE id=_job_id;

  UPDATE public.job_escrows SET status='refunded', released_at=now() WHERE id=v_e.id;
  PERFORM public.post_ledger(v_e.employer_id,'escrow_release','credit','held',v_e.amount_cents,'Unlocked from "'||v_title||'"',NULL,_job_id,v_e.worker_id);
  PERFORM public.post_ledger(v_e.employer_id,'refund','credit','settled',v_e.amount_cents,'Refund from "'||v_title||'"',NULL,_job_id,v_e.worker_id);
  IF v_e.worker_id IS NOT NULL THEN
    UPDATE public.wallet_ledger SET status='cancelled'
     WHERE user_id=v_e.worker_id AND job_id=_job_id AND status='pending' AND entry_type='escrow_incoming';
  END IF;
  RETURN jsonb_build_object('ok',true);
END; $$;

-- staff can act on payments too
GRANT EXECUTE ON FUNCTION public.wallet_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_start_topup(integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_cancel_topup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_request_withdrawal(integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escrow_fund_job(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escrow_set_status(uuid,public.escrow_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escrow_release(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escrow_refund(uuid,text) TO authenticated;
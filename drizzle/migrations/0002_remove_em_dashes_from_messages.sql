DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('escrow_fund_job','escrow_refund','market_buy') LOOP
    EXECUTE replace(replace(pg_get_functiondef(r.oid), ' — ', ', '), '—', ', ');
  END LOOP;
END $$;
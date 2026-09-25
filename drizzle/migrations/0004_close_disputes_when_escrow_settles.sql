CREATE OR REPLACE FUNCTION public.on_escrow_settled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('released','refunded') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.disputes
       SET status = CASE WHEN NEW.status='released' THEN 'resolved_release' ELSE 'resolved_refund' END,
           resolution_note = coalesce(resolution_note, CASE WHEN NEW.status='released' THEN 'The employer released the payment' ELSE 'The payment was returned to the employer' END),
           resolved_at = now()
     WHERE job_id = NEW.job_id AND status = 'open';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.on_escrow_settled() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER escrow_settled_closes_disputes AFTER UPDATE OF status ON public.job_escrows
  FOR EACH ROW EXECUTE FUNCTION public.on_escrow_settled();
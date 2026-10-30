LOCK TABLE credit_wallets IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE incompatible TEXT;
BEGIN
  SELECT string_agg('wallet_id=' || id::text || '/user_id=' || user_id::text, ', ' ORDER BY id)
    INTO incompatible FROM credit_wallets
  WHERE NOT (
    (plan_type = 'LIFETIME_FREE' AND is_unlimited AND expires_at IS NULL)
    OR (plan_type IN ('TRIAL', 'MONTHLY', 'QUARTERLY', 'ANNUAL') AND NOT is_unlimited
      AND expires_at IS NOT NULL AND isfinite(expires_at))
    OR (plan_type = 'BIMONTHLY' AND NOT is_unlimited AND (expires_at IS NULL OR isfinite(expires_at)))
  );
  IF incompatible IS NOT NULL THEN
    RAISE EXCEPTION 'Incompatible subscription plans. Resolve manually: %', incompatible;
  END IF;
END;
$$;
ALTER TABLE credit_wallets ADD CONSTRAINT chk_wallet_plan_configuration CHECK (
  (plan_type = 'LIFETIME_FREE' AND is_unlimited AND expires_at IS NULL)
  OR (plan_type IN ('TRIAL', 'MONTHLY', 'QUARTERLY', 'ANNUAL') AND NOT is_unlimited
    AND expires_at IS NOT NULL AND isfinite(expires_at))
  OR (plan_type = 'BIMONTHLY' AND NOT is_unlimited AND (expires_at IS NULL OR isfinite(expires_at)))
);
CREATE FUNCTION reject_new_historical_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan_type = 'BIMONTHLY' THEN
    IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'BIMONTHLY is historical and cannot be assigned'; END IF;
    IF OLD.plan_type IS DISTINCT FROM NEW.plan_type OR OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'BIMONTHLY is historical and cannot be assigned';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER wallet_historical_plan BEFORE INSERT OR UPDATE OF plan_type, user_id ON credit_wallets
FOR EACH ROW EXECUTE FUNCTION reject_new_historical_plan();

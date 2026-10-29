-- Historical rows intentionally retain NULL for information that was not recorded.
ALTER TABLE wallet_transactions
  ADD COLUMN actor_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN balance_before INTEGER CHECK (balance_before >= 0),
  ADD COLUMN balance_after INTEGER CHECK (balance_after >= 0),
  ADD COLUMN plan_type_before subscription_plan,
  ADD COLUMN plan_type_after subscription_plan,
  ADD COLUMN expires_at_before TIMESTAMPTZ,
  ADD COLUMN expires_at_after TIMESTAMPTZ,
  ADD COLUMN is_unlimited_before BOOLEAN,
  ADD COLUMN is_unlimited_after BOOLEAN,
  ADD CONSTRAINT chk_wallet_movement_balance CHECK (
    balance_before IS NULL OR balance_after IS NULL OR balance_after = balance_before + amount
  );
CREATE INDEX idx_wallet_transactions_history ON wallet_transactions(wallet_id, created_at DESC, id);

CREATE FUNCTION require_admin_wallet_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.transaction_type = 'ADMIN_MANUAL_ADJUSTMENT'
     AND (NEW.actor_user_id IS NULL OR NEW.balance_before IS NULL OR NEW.balance_after IS NULL
       OR NEW.plan_type_before IS NULL OR NEW.plan_type_after IS NULL
       OR NEW.is_unlimited_before IS NULL OR NEW.is_unlimited_after IS NULL
       OR NEW.note IS NULL OR length(trim(NEW.note)) = 0) THEN
    RAISE EXCEPTION 'Administrative movements require actor, reason and before/after audit data';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER wallet_admin_audit BEFORE INSERT ON wallet_transactions
FOR EACH ROW EXECUTE FUNCTION require_admin_wallet_audit();

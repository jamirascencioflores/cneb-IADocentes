ALTER TABLE users
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0 CHECK (token_version >= 0);

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);

-- Applies to administrative operations too; reactivation never restores old JWTs.
CREATE FUNCTION enforce_user_token_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.is_active AND NOT NEW.is_active)
     OR OLD.password_hash IS DISTINCT FROM NEW.password_hash
     OR OLD.role IS DISTINCT FROM NEW.role THEN
    NEW.token_version := GREATEST(NEW.token_version, OLD.token_version + 1);
  END IF;
  IF NEW.token_version < OLD.token_version THEN
    RAISE EXCEPTION 'token_version cannot decrease';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_token_version BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION enforce_user_token_version();

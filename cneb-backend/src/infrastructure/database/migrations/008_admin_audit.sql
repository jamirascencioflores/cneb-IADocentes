CREATE TABLE admin_audit_events (
  id UUID PRIMARY KEY,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_role user_role NOT NULL CHECK (actor_role = 'SUPERADMIN'),
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id UUID NOT NULL,
  reason VARCHAR(255) NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 255),
  before_data JSONB,
  after_data JSONB,
  request_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_audit_entity ON admin_audit_events(entity_type, entity_id, created_at DESC, id);
ALTER TABLE wallet_transactions ADD COLUMN admin_audit_event_id UUID REFERENCES admin_audit_events(id) ON DELETE RESTRICT;
CREATE FUNCTION protect_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Administrative audit is append-only';
END;
$$;
CREATE TRIGGER admin_audit_immutable BEFORE UPDATE OR DELETE ON admin_audit_events
FOR EACH ROW EXECUTE FUNCTION protect_admin_audit();
CREATE TRIGGER admin_audit_no_truncate BEFORE TRUNCATE ON admin_audit_events
FOR EACH STATEMENT EXECUTE FUNCTION protect_admin_audit();

-- Defense in depth for future callers: credential fields cannot enter JSON snapshots.
CREATE FUNCTION admin_audit_contains_secret(document JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE entry RECORD; element JSONB;
BEGIN
  IF jsonb_typeof(document) = 'object' THEN
    FOR entry IN SELECT * FROM jsonb_each(document) LOOP
      IF lower(replace(entry.key, '_', '')) IN (
        'password', 'passwordhash', 'temporarypassword', 'currentpassword', 'newpassword',
        'accesstoken', 'refreshtoken', 'jwt', 'cookie', 'cookies', 'authorization', 'sid'
      ) OR admin_audit_contains_secret(entry.value) THEN RETURN TRUE; END IF;
    END LOOP;
  ELSIF jsonb_typeof(document) = 'array' THEN
    FOR element IN SELECT value FROM jsonb_array_elements(document) LOOP
      IF admin_audit_contains_secret(element) THEN RETURN TRUE; END IF;
    END LOOP;
  END IF;
  RETURN FALSE;
END;
$$;
ALTER TABLE admin_audit_events ADD CONSTRAINT chk_admin_audit_no_credentials CHECK (
  NOT admin_audit_contains_secret(before_data) AND NOT admin_audit_contains_secret(after_data)
);
CREATE FUNCTION require_current_admin_actor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users WHERE id = NEW.actor_user_id AND role = 'SUPERADMIN'
    AND is_active AND NOT must_change_password FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Administrative audit requires an enabled SUPERADMIN'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER admin_audit_actor BEFORE INSERT ON admin_audit_events
FOR EACH ROW EXECUTE FUNCTION require_current_admin_actor();

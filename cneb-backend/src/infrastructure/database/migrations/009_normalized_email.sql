-- Never merge or rewrite existing accounts. Report identifiers, not credentials.
LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE incompatible TEXT;
BEGIN
  SELECT string_agg(id::text, ', ' ORDER BY id) INTO incompatible
  FROM users WHERE email <> lower(btrim(email)) OR email !~ '^[!-~]+$'
    OR lower(btrim(email)) IN (
      SELECT lower(btrim(email)) FROM users GROUP BY lower(btrim(email)) HAVING count(*) > 1
    );
  IF incompatible IS NOT NULL THEN
    RAISE EXCEPTION 'Incompatible or duplicate normalized emails. Resolve manually. user_id: %', incompatible;
  END IF;
END;
$$;
CREATE UNIQUE INDEX uq_users_normalized_email ON users(lower(btrim(email)));
-- Residual whitespace (tabs, line breaks, Unicode spacing) cannot bypass normalization.
ALTER TABLE users ADD CONSTRAINT chk_users_normalized_email CHECK (email = lower(btrim(email)) AND email ~ '^[!-~]+$');
CREATE FUNCTION normalize_user_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_normalized_email BEFORE INSERT OR UPDATE OF email ON users
FOR EACH ROW EXECUTE FUNCTION normalize_user_email();

LOCK TABLE users, institutional_profiles, credit_wallets IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE incompatible TEXT;
BEGIN
  SELECT string_agg(id::text, ', ' ORDER BY id) INTO incompatible FROM users u
  WHERE (u.role = 'TEACHER' AND (
    (SELECT count(*) FROM institutional_profiles p WHERE p.user_id = u.id) <> 1 OR
    (SELECT count(*) FROM credit_wallets w WHERE w.user_id = u.id) <> 1
  )) OR (u.role = 'SUPERADMIN' AND (
    EXISTS (SELECT 1 FROM institutional_profiles p WHERE p.user_id = u.id) OR
    EXISTS (SELECT 1 FROM credit_wallets w WHERE w.user_id = u.id)
  ));
  IF incompatible IS NOT NULL THEN
    RAISE EXCEPTION 'Incompatible teacher composition. No records repaired or deleted. user_id: %', incompatible;
  END IF;
END;
$$;
-- CURRENT_ROLE is a SQL value expression, not a safe PL/pgSQL variable name.
-- Validate the application role explicitly after locking the surviving parent.
CREATE FUNCTION enforce_teacher_composition(p_user_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_user_role user_role; v_profile_count BIGINT; v_wallet_count BIGINT;
BEGIN
  SELECT u.role INTO v_user_role FROM users AS u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF; -- Parent deletion and its cascades are valid.
  SELECT count(*) INTO v_profile_count FROM institutional_profiles AS p WHERE p.user_id = p_user_id;
  SELECT count(*) INTO v_wallet_count FROM credit_wallets AS w WHERE w.user_id = p_user_id;
  IF (v_user_role = 'TEACHER' AND (v_profile_count <> 1 OR v_wallet_count <> 1))
    OR (v_user_role = 'SUPERADMIN' AND (v_profile_count <> 0 OR v_wallet_count <> 0)) THEN
    RAISE EXCEPTION 'Invalid teacher composition. user_id: %', p_user_id;
  END IF;
END;
$$;

-- Acquire all affected parent locks in UUID order before validating either owner.
-- Reassignments must check both OLD and NEW; NULL/duplicate IDs are discarded.
CREATE FUNCTION enforce_teacher_composition_owners(p_old_user_id UUID, p_new_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_owner_id UUID;
BEGIN
  FOR v_owner_id IN SELECT DISTINCT candidate FROM unnest(ARRAY[p_old_user_id, p_new_user_id]) AS t(candidate)
    WHERE candidate IS NOT NULL ORDER BY candidate LOOP
    PERFORM 1 FROM users AS u WHERE u.id = v_owner_id FOR UPDATE;
  END LOOP;
  FOR v_owner_id IN SELECT DISTINCT candidate FROM unnest(ARRAY[p_old_user_id, p_new_user_id]) AS t(candidate)
    WHERE candidate IS NOT NULL ORDER BY candidate LOOP
    PERFORM enforce_teacher_composition(v_owner_id);
  END LOOP;
END;
$$;

CREATE FUNCTION enforce_users_teacher_composition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enforce_teacher_composition_owners(NULL, NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM enforce_teacher_composition_owners(OLD.id, NEW.id);
  ELSE
    PERFORM enforce_teacher_composition_owners(OLD.id, NULL);
  END IF;
  RETURN NULL;
END;
$$;
CREATE FUNCTION enforce_profiles_teacher_composition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enforce_teacher_composition_owners(NULL, NEW.user_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM enforce_teacher_composition_owners(OLD.user_id, NEW.user_id);
  ELSE
    PERFORM enforce_teacher_composition_owners(OLD.user_id, NULL);
  END IF;
  RETURN NULL;
END;
$$;
CREATE FUNCTION enforce_wallets_teacher_composition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enforce_teacher_composition_owners(NULL, NEW.user_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM enforce_teacher_composition_owners(OLD.user_id, NEW.user_id);
  ELSE
    PERFORM enforce_teacher_composition_owners(OLD.user_id, NULL);
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER users_teacher_composition AFTER INSERT OR UPDATE OR DELETE ON users
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_users_teacher_composition();
CREATE CONSTRAINT TRIGGER profiles_teacher_composition AFTER INSERT OR UPDATE OR DELETE ON institutional_profiles
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_profiles_teacher_composition();
CREATE CONSTRAINT TRIGGER wallets_teacher_composition AFTER INSERT OR UPDATE OR DELETE ON credit_wallets
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_wallets_teacher_composition();

-- TRUNCATE does not run row/constraint triggers and would bypass composition checks.
CREATE FUNCTION prevent_teacher_dependency_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE would bypass teacher composition constraints';
END;
$$;
CREATE TRIGGER profiles_no_truncate BEFORE TRUNCATE ON institutional_profiles
FOR EACH STATEMENT EXECUTE FUNCTION prevent_teacher_dependency_truncate();
CREATE TRIGGER wallets_no_truncate BEFORE TRUNCATE ON credit_wallets
FOR EACH STATEMENT EXECUTE FUNCTION prevent_teacher_dependency_truncate();

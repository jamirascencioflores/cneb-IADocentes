-- Never reconstruct historical identity from today's profile.
ALTER TABLE learning_sessions ADD COLUMN institutional_snapshot JSONB;

CREATE FUNCTION preserve_session_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.user_id IS DISTINCT FROM NEW.user_id
     OR (OLD.institutional_snapshot IS NOT NULL
         AND OLD.institutional_snapshot IS DISTINCT FROM NEW.institutional_snapshot) THEN
    RAISE EXCEPTION 'Session owner and recorded institutional identity are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER learning_session_identity BEFORE UPDATE ON learning_sessions
FOR EACH ROW EXECUTE FUNCTION preserve_session_identity();

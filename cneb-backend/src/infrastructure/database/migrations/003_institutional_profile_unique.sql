LOCK TABLE institutional_profiles IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE affected TEXT;
BEGIN
  SELECT string_agg(user_id::text, ', ' ORDER BY user_id::text) INTO affected
  FROM (SELECT user_id FROM institutional_profiles GROUP BY user_id HAVING COUNT(*) > 1) duplicates;
  IF affected IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate institutional profiles. Resolve manually; no records were deleted. user_id: %', affected;
  END IF;
END;
$$;
ALTER TABLE institutional_profiles ADD CONSTRAINT uq_institutional_profile_user UNIQUE(user_id);
CREATE INDEX idx_users_teacher_list ON users(is_active, created_at DESC, id) WHERE role = 'TEACHER';
CREATE INDEX idx_sessions_owner_date ON learning_sessions(user_id, created_at DESC, id);

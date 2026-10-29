-- Read-only manual review. Replace the exact email before executing.
-- No migration or application startup runs this file.
SELECT id, email, role, is_active FROM users
WHERE lower(email) = lower('docente.demo@cneb.pe');
SELECT p.* FROM institutional_profiles p JOIN users u ON u.id = p.user_id
WHERE lower(u.email) = lower('docente.demo@cneb.pe');
SELECT w.* FROM credit_wallets w JOIN users u ON u.id = w.user_id
WHERE lower(u.email) = lower('docente.demo@cneb.pe');
SELECT t.* FROM wallet_transactions t JOIN credit_wallets w ON w.id = t.wallet_id
JOIN users u ON u.id = w.user_id WHERE lower(u.email) = lower('docente.demo@cneb.pe')
ORDER BY t.created_at;
SELECT s.id, s.session_title, s.created_at FROM learning_sessions s JOIN users u ON u.id = s.user_id
WHERE lower(u.email) = lower('docente.demo@cneb.pe') ORDER BY s.created_at;

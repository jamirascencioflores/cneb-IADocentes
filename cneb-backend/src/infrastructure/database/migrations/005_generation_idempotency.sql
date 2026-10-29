CREATE TABLE generation_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  idempotency_key VARCHAR(128) NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  attempt_id UUID NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  session_id UUID UNIQUE REFERENCES learning_sessions(id),
  response JSONB,
  error_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, idempotency_key),
  CHECK ((status = 'COMPLETED') = (session_id IS NOT NULL AND response IS NOT NULL))
);
CREATE INDEX idx_generation_requests_user ON generation_requests(user_id, created_at DESC);
ALTER TABLE wallet_transactions ADD COLUMN generation_request_id UUID UNIQUE REFERENCES generation_requests(id);

-- Commit this migration before any transaction uses the new enum value.
ALTER TYPE transaction_type ADD VALUE 'SESSION_GENERATION_DEBIT';

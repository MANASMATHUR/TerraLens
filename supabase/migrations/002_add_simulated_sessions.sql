-- Prefix-based QA identities are strings, and every scripted session is explicitly labelled.
ALTER TABLE experiment_sessions
  ALTER COLUMN participant_id TYPE TEXT USING participant_id::TEXT;

ALTER TABLE experiment_sessions
  ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN NOT NULL DEFAULT FALSE;

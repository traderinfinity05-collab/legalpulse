-- Phase 2a: contact form submissions. Stored in DB rather than emailed
-- (no SMTP / Resend dep yet) — operator reads from Supabase dashboard.
--
-- Idempotent: IF NOT EXISTS so re-runs are safe.

SET search_path TO legalpulse, public;

CREATE TABLE IF NOT EXISTS legalpulse.contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  message     TEXT NOT NULL,
  user_agent  TEXT,
  ip_hash     TEXT,                     -- SHA-256 of IP, for rate-limit dedupe (no raw IP retained)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON legalpulse.contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_unread_idx ON legalpulse.contact_messages (created_at DESC) WHERE read_at IS NULL;

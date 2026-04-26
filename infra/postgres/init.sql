-- LegalPulse schema. Mirrors the data model in web/lib/schemas.ts (Zod).
--
-- Why CHECK constraints over ENUMs: enums are painful to migrate (need
-- ALTER TYPE; not transactional in some hosts). CHECKs let us add allowed
-- values with a plain ALTER TABLE.
--
-- Why a dedicated schema: this database may host other products (e.g. the
-- user's nifty50-pulse trading app). All LegalPulse objects live inside
-- the `legalpulse` schema so backups, drops, and migrations don't entangle.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

CREATE SCHEMA IF NOT EXISTS legalpulse;
SET search_path TO legalpulse, public;

-- ─── reports ────────────────────────────────────────────────────────────
-- One row per published WeeklyReport. Idempotency key is (week_of, country,
-- COALESCE(state, '')) — running the pipeline twice in the same week must
-- not produce duplicates (Quality bar #4).

CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  week_of         DATE NOT NULL,                     -- Monday of the report's week
  country         TEXT NOT NULL CHECK (country IN ('USA', 'INDIA')),
  state           TEXT,
  title           TEXT NOT NULL,
  executive_summary JSONB NOT NULL,                  -- string[]
  mdx_content     TEXT NOT NULL,
  pdf_url         TEXT,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reports_week_country_state_unique
    UNIQUE (week_of, country, state)
);

CREATE INDEX reports_country_week_idx ON reports (country, week_of DESC);
CREATE INDEX reports_generated_at_idx ON reports (generated_at DESC);

-- ─── events ─────────────────────────────────────────────────────────────
-- LegalChangeEvent — one row per detected source change. content_hash is
-- the dedupe key (Phase 2 research agent populates this).

CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country         TEXT NOT NULL CHECK (country IN ('USA', 'INDIA')),
  state           TEXT,
  source_url      TEXT NOT NULL,
  source_type     TEXT NOT NULL CHECK (source_type IN ('regulator', 'court', 'legislature', 'social')),
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  raw_excerpt     TEXT NOT NULL,
  effective_date  DATE,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  industries      TEXT[] NOT NULL DEFAULT '{}',
  content_hash    TEXT NOT NULL UNIQUE
);

CREATE INDEX events_country_detected_idx ON events (country, detected_at DESC);
CREATE INDEX events_industries_idx ON events USING GIN (industries);

-- ─── analyses ──────────────────────────────────────────────────────────
-- ImpactAnalysis — one row per (event, industry) pair. Citations stored
-- inline as JSONB (each element: { url, retrieved_at }).

CREATE TABLE analyses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  industry              TEXT NOT NULL,
  severity              TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  affected_archetypes   TEXT[] NOT NULL DEFAULT '{}',
  time_to_comply_days   INTEGER,
  cost_band             TEXT NOT NULL CHECK (cost_band IN ('<$100K', '$100K-$1M', '$1M-$10M', '>$10M', 'unknown')),
  recommended_actions   JSONB NOT NULL DEFAULT '[]',  -- string[]
  second_order_effects  JSONB NOT NULL DEFAULT '[]',  -- string[]
  citations             JSONB NOT NULL DEFAULT '[]',  -- {url, retrieved_at}[]
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT analyses_event_industry_unique UNIQUE (event_id, industry)
);

CREATE INDEX analyses_industry_severity_idx ON analyses (industry, severity);

-- ─── report_events / report_analyses ────────────────────────────────────
-- Many-to-many joins so a report can reference events/analyses without
-- duplicating them.

CREATE TABLE report_events (
  report_id  UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (report_id, event_id)
);

CREATE TABLE report_analyses (
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  PRIMARY KEY (report_id, analysis_id)
);

-- ─── newsletter_signups ─────────────────────────────────────────────────

CREATE TABLE newsletter_signups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- ─── contact_messages ───────────────────────────────────────────────────
-- Submissions from the /contact form. Stored here rather than emailed —
-- operator reads from the Supabase dashboard. Phase 4 may add an admin UI.

CREATE TABLE contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  message     TEXT NOT NULL,
  user_agent  TEXT,
  ip_hash     TEXT,                     -- SHA-256 of IP for rate-limit dedupe
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX contact_messages_created_idx ON contact_messages (created_at DESC);
CREATE INDEX contact_messages_unread_idx ON contact_messages (created_at DESC) WHERE read_at IS NULL;

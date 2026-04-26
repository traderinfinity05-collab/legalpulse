// Build a single safely-quoted SQL statement from a pipeline JSON artifact.
// Used by the *remote* path of /weekly-pipeline (Anthropic routines): the
// agent runs this script via Bash, captures stdout, then sends the SQL to
// `mcp__claude_ai_Supabase__execute_sql`. No DB connection needed here.
//
// Local dev keeps using web/scripts/persist.mjs, which talks directly to
// Postgres via DATABASE_URL.
//
// Usage (from anywhere; pass the JSON file's path):
//   node web/scripts/build-sql.mjs events   .pipeline/2026-04-20/events.json
//   node web/scripts/build-sql.mjs analyses .pipeline/2026-04-20/analyses-financial.json
//   node web/scripts/build-sql.mjs report   .pipeline/2026-04-20/report-usa.json
//
// Why a separate script rather than building SQL inline in the skill: the
// agent can't safely string-concat SQL when JSON values contain quotes,
// backslashes, or newlines. This script handles all the escaping in one
// audited place.

import { readFileSync } from "node:fs";

const [, , action, file] = process.argv;
if (!action || !file) {
  console.error("usage: build-sql.mjs <events|analyses|report> <path-to-json>");
  process.exit(1);
}

// Single-quoted SQL string literal. PG escape: double the quote.
const Q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
// PG TEXT[] literal via ARRAY[..]::text[]. Each element is Q-quoted.
const ARR = (xs) => "ARRAY[" + (xs || []).map(Q).join(",") + "]::text[]";
// JSON literal cast to jsonb. We Q-quote the JSON.stringify output so any
// embedded ' is properly doubled.
const JSONB = (v) => Q(JSON.stringify(v)) + "::jsonb";
const NULLABLE = (v, fmt = Q) => (v == null ? "NULL" : fmt(v));

function buildEvents(events) {
  if (!Array.isArray(events)) throw new Error("events payload must be an array");
  if (events.length === 0) {
    return "SELECT 'no events to insert' AS note;";
  }
  const rows = events
    .map(
      (e) => `(
    ${Q(e.country)},
    ${NULLABLE(e.state)},
    ${Q(e.source_url)},
    ${Q(e.source_type)},
    ${Q(e.title)},
    ${Q(e.summary)},
    ${Q(e.raw_excerpt)},
    ${NULLABLE(e.effective_date, (v) => Q(v) + "::date")},
    ${ARR(e.industries)},
    ${Q(e.content_hash)}
  )`,
    )
    .join(",\n");
  return `INSERT INTO legalpulse.events (
  country, state, source_url, source_type, title, summary,
  raw_excerpt, effective_date, industries, content_hash
) VALUES
${rows}
ON CONFLICT (content_hash) DO NOTHING
RETURNING id, content_hash;`;
}

function buildAnalyses(analyses) {
  if (!Array.isArray(analyses)) throw new Error("analyses payload must be an array");
  if (analyses.length === 0) return "SELECT 'no analyses to insert' AS note;";
  // Each analysis references its event by content_hash (preferred) or event_id.
  // Server-side LEFT JOIN resolves event_id from events.content_hash.
  const rows = analyses
    .map(
      (a) => `(
    ${Q(a.content_hash || "")},
    ${a.event_id ? Q(a.event_id) + "::uuid" : "NULL::uuid"},
    ${Q(a.industry)},
    ${Q(a.severity)},
    ${ARR(a.affected_archetypes)},
    ${a.time_to_comply_days == null ? "NULL::int" : `${a.time_to_comply_days}::int`},
    ${Q(a.cost_band)},
    ${JSONB(a.recommended_actions || [])},
    ${JSONB(a.second_order_effects || [])},
    ${JSONB(a.citations || [])}
  )`,
    )
    .join(",\n");
  return `WITH input(content_hash, event_id, industry, severity, affected_archetypes,
                time_to_comply_days, cost_band, recommended_actions,
                second_order_effects, citations) AS (
  VALUES
${rows}
)
INSERT INTO legalpulse.analyses (
  event_id, industry, severity, affected_archetypes,
  time_to_comply_days, cost_band, recommended_actions,
  second_order_effects, citations
)
SELECT
  COALESCE(input.event_id, e.id) AS event_id,
  input.industry, input.severity, input.affected_archetypes,
  input.time_to_comply_days, input.cost_band, input.recommended_actions,
  input.second_order_effects, input.citations
  FROM input
  LEFT JOIN legalpulse.events e ON e.content_hash = input.content_hash
 WHERE COALESCE(input.event_id, e.id) IS NOT NULL
ON CONFLICT (event_id, industry) DO UPDATE SET
  severity              = EXCLUDED.severity,
  affected_archetypes   = EXCLUDED.affected_archetypes,
  time_to_comply_days   = EXCLUDED.time_to_comply_days,
  cost_band             = EXCLUDED.cost_band,
  recommended_actions   = EXCLUDED.recommended_actions,
  second_order_effects  = EXCLUDED.second_order_effects,
  citations             = EXCLUDED.citations
RETURNING id, industry, (xmax = 0) AS was_insert;`;
}

function buildReport(r) {
  if (Array.isArray(r) || typeof r !== "object" || r == null) {
    throw new Error("report payload must be a single object");
  }
  // Conflict target is `slug` (deterministic per week+country+state). The
  // table's (week_of, country, state) UNIQUE constraint doesn't dedupe NULL
  // state values — Postgres treats NULLs as distinct in unique constraints —
  // so using slug here makes re-runs idempotent until that constraint is
  // fixed via migration.
  return `INSERT INTO legalpulse.reports (
  slug, week_of, country, state, title,
  executive_summary, mdx_content, pdf_url
) VALUES (
  ${Q(r.slug)},
  ${Q(r.week_of)}::date,
  ${Q(r.country)},
  ${NULLABLE(r.state)},
  ${Q(r.title)},
  ${JSONB(r.executive_summary)},
  ${Q(r.mdx_content)},
  ${r.pdf_url == null ? "NULL" : Q(r.pdf_url)}
)
ON CONFLICT (slug) DO UPDATE SET
  week_of           = EXCLUDED.week_of,
  country           = EXCLUDED.country,
  state             = EXCLUDED.state,
  title             = EXCLUDED.title,
  executive_summary = EXCLUDED.executive_summary,
  mdx_content       = EXCLUDED.mdx_content,
  pdf_url           = COALESCE(EXCLUDED.pdf_url, legalpulse.reports.pdf_url)
RETURNING id, slug, (xmax = 0) AS was_insert;`;
}

let sql;
try {
  const payload = JSON.parse(readFileSync(file, "utf8"));
  if (action === "events") sql = buildEvents(payload);
  else if (action === "analyses") sql = buildAnalyses(payload);
  else if (action === "report") sql = buildReport(payload);
  else throw new Error(`unknown action: ${action}`);
} catch (err) {
  console.error("✗ build-sql failed:", err.message);
  process.exit(1);
}
process.stdout.write(sql + "\n");

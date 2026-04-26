// Persistence CLI for the weekly pipeline. Subagents emit JSON artifacts
// into legalpulse/.pipeline/<week>/, and the orchestrator slash command
// invokes this script via Bash to validate + insert into Postgres.
//
// Usage (from web/, with .env loaded):
//   node --env-file=.env scripts/persist.mjs events  ../.pipeline/2026-04-20/events.json
//   node --env-file=.env scripts/persist.mjs analyses ../.pipeline/2026-04-20/analyses-financial.json
//   node --env-file=.env scripts/persist.mjs report   ../.pipeline/2026-04-20/report.json
//
// Why a CLI rather than the agents speaking SQL: agents are great at
// producing structured JSON and terrible at writing safe parameterised
// SQL. We move the SQL into one place that's easy to audit, run by hand,
// and unit-test. Agents only have to write JSON files.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { z } from "zod";

// ─── Schemas (mirrors web/lib/schemas.ts; duplicated here so this script
// can be invoked without the Next.js build artifacts). Keep in sync.

const Country = z.enum(["USA", "INDIA"]);
const SourceType = z.enum(["regulator", "court", "legislature", "social"]);
const Severity = z.enum(["low", "medium", "high", "critical"]);
const CostBand = z.enum(["<$100K", "$100K-$1M", "$1M-$10M", ">$10M", "unknown"]);

const EventInput = z.object({
  country: Country,
  state: z.string().nullable().optional(),
  source_url: z.string().url(),
  source_type: SourceType,
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(2000),
  raw_excerpt: z.string().max(500),
  effective_date: z.string().nullable().optional(),
  industries: z.array(z.string()).default([]),
  content_hash: z.string().min(8),
});

const AnalysisInput = z.object({
  // Either content_hash (preferred — agents don't know event UUIDs yet)
  // or event_id (if the agent has a way to know it).
  content_hash: z.string().min(8).optional(),
  event_id: z.string().uuid().optional(),
  industry: z.string().min(1),
  severity: Severity,
  affected_archetypes: z.array(z.string()).default([]),
  time_to_comply_days: z.number().int().nullable().optional(),
  cost_band: CostBand,
  recommended_actions: z.array(z.string()).default([]),
  second_order_effects: z.array(z.string()).default([]),
  citations: z
    .array(z.object({ url: z.string().url(), retrieved_at: z.string() }))
    .min(1, "every analysis must carry at least one citation"),
}).refine((v) => v.content_hash || v.event_id, {
  message: "analysis must reference content_hash or event_id",
});

const ReportInput = z.object({
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  week_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "week_of must be YYYY-MM-DD"),
  country: Country,
  state: z.string().nullable().optional(),
  title: z.string().min(1).max(500),
  executive_summary: z.array(z.string()).min(1).max(10),
  mdx_content: z.string().min(50),
  pdf_url: z.string().url().nullable().optional(),
  // Optional cross-references — orchestrator can pass these so the report
  // links to the events/analyses that fed it.
  event_content_hashes: z.array(z.string()).optional(),
  analysis_keys: z
    .array(z.object({ content_hash: z.string(), industry: z.string() }))
    .optional(),
});

// ─── DB setup

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Source web/.env first.");
  process.exit(1);
}
const sql = postgres(url, {
  max: 1,
  onnotice: () => {},
  connection: { search_path: "legalpulse,public" },
});

// ─── Actions

async function persistEvents(payload) {
  const events = z.array(EventInput).parse(payload);
  let inserted = 0;
  let skipped = 0;
  for (const e of events) {
    const rows = await sql`
      INSERT INTO legalpulse.events (
        country, state, source_url, source_type, title, summary,
        raw_excerpt, effective_date, industries, content_hash
      ) VALUES (
        ${e.country}, ${e.state ?? null}, ${e.source_url}, ${e.source_type},
        ${e.title}, ${e.summary}, ${e.raw_excerpt},
        ${e.effective_date ?? null}, ${e.industries}, ${e.content_hash}
      )
      ON CONFLICT (content_hash) DO NOTHING
      RETURNING id
    `;
    if (rows.length > 0) inserted++;
    else skipped++;
  }
  return { events_inserted: inserted, events_skipped_dup: skipped };
}

async function persistAnalyses(payload) {
  const analyses = z.array(AnalysisInput).parse(payload);
  let inserted = 0;
  let skipped = 0;
  for (const a of analyses) {
    // Resolve event_id from content_hash if not provided directly.
    let eventId = a.event_id ?? null;
    if (!eventId) {
      const r = await sql`
        SELECT id FROM legalpulse.events WHERE content_hash = ${a.content_hash} LIMIT 1
      `;
      if (r.length === 0) {
        console.warn(`! no event for content_hash=${a.content_hash} (industry=${a.industry}); skipping`);
        skipped++;
        continue;
      }
      eventId = r[0].id;
    }
    const rows = await sql`
      INSERT INTO legalpulse.analyses (
        event_id, industry, severity, affected_archetypes,
        time_to_comply_days, cost_band, recommended_actions,
        second_order_effects, citations
      ) VALUES (
        ${eventId}, ${a.industry}, ${a.severity}, ${a.affected_archetypes},
        ${a.time_to_comply_days ?? null}, ${a.cost_band},
        ${a.recommended_actions}::jsonb,
        ${a.second_order_effects}::jsonb,
        ${a.citations}::jsonb
      )
      ON CONFLICT (event_id, industry) DO UPDATE SET
        severity = EXCLUDED.severity,
        affected_archetypes = EXCLUDED.affected_archetypes,
        time_to_comply_days = EXCLUDED.time_to_comply_days,
        cost_band = EXCLUDED.cost_band,
        recommended_actions = EXCLUDED.recommended_actions,
        second_order_effects = EXCLUDED.second_order_effects,
        citations = EXCLUDED.citations
      RETURNING id, (xmax = 0) AS was_insert
    `;
    if (rows[0].was_insert) inserted++;
    else skipped++;
  }
  return { analyses_inserted: inserted, analyses_updated: skipped };
}

async function persistReport(payload) {
  const r = ReportInput.parse(payload);

  // Upsert by (week_of, country, state) — Quality bar #4 idempotency.
  const reportRows = await sql`
    INSERT INTO legalpulse.reports (
      slug, week_of, country, state, title, executive_summary,
      mdx_content, pdf_url
    ) VALUES (
      ${r.slug}, ${r.week_of}, ${r.country}, ${r.state ?? null},
      ${r.title}, ${r.executive_summary}::jsonb,
      ${r.mdx_content}, ${r.pdf_url ?? null}
    )
    ON CONFLICT (week_of, country, state) DO UPDATE SET
      slug = EXCLUDED.slug,
      title = EXCLUDED.title,
      executive_summary = EXCLUDED.executive_summary,
      mdx_content = EXCLUDED.mdx_content,
      pdf_url = COALESCE(EXCLUDED.pdf_url, reports.pdf_url)
    RETURNING id, slug, (xmax = 0) AS was_insert
  `;
  const reportId = reportRows[0].id;

  // Optional cross-references
  if (r.event_content_hashes?.length) {
    await sql`
      INSERT INTO legalpulse.report_events (report_id, event_id)
      SELECT ${reportId}, e.id
        FROM legalpulse.events e
        WHERE e.content_hash = ANY(${r.event_content_hashes})
      ON CONFLICT DO NOTHING
    `;
  }
  if (r.analysis_keys?.length) {
    // Resolve (content_hash, industry) → analysis_id and link.
    for (const k of r.analysis_keys) {
      await sql`
        INSERT INTO legalpulse.report_analyses (report_id, analysis_id)
        SELECT ${reportId}, a.id
          FROM legalpulse.analyses a
          JOIN legalpulse.events e ON e.id = a.event_id
          WHERE e.content_hash = ${k.content_hash}
            AND a.industry = ${k.industry}
        ON CONFLICT DO NOTHING
      `;
    }
  }

  return {
    report_id: reportId,
    slug: reportRows[0].slug,
    action: reportRows[0].was_insert ? "inserted" : "updated",
  };
}

// ─── Entry

const action = process.argv[2];
const file = process.argv[3];

if (!action || !file) {
  console.error("usage: persist.mjs <events|analyses|report> <path-to-json>");
  process.exit(1);
}

try {
  const payload = JSON.parse(readFileSync(resolve(file), "utf8"));
  let result;
  if (action === "events") result = await persistEvents(payload);
  else if (action === "analyses") result = await persistAnalyses(payload);
  else if (action === "report") result = await persistReport(payload);
  else {
    console.error(`unknown action: ${action}`);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  if (err instanceof z.ZodError) {
    console.error("✗ validation failed:");
    for (const issue of err.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
  } else {
    console.error("✗ persist failed:", err.message);
  }
  process.exitCode = 1;
} finally {
  await sql.end();
}

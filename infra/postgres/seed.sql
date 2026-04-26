-- Phase 1 stub seed. ONE fake report so the web layer has something to render.
-- DELETE THIS FILE when Phase 2 lands — real reports come from the agents.
--
-- Idempotent: ON CONFLICT DO NOTHING means re-running the seed is safe.

SET search_path TO legalpulse, public;

INSERT INTO reports (slug, week_of, country, state, title, executive_summary, mdx_content)
VALUES (
  'usa-2026-04-20-stub',
  '2026-04-20',
  'USA',
  NULL,
  'Weekly Legal Pulse — United States, week of April 20, 2026',
  '[
    "Phase 1 stub report. Real agent output replaces this in Phase 2.",
    "Schema, API, and rendering pipeline are validated end-to-end by this single record.",
    "Citations, severity matrices, and industry deep-dives are wired up but unpopulated."
  ]'::jsonb,
  $mdx$
# Weekly Legal Pulse — United States

> **This is a Phase 1 stub.** Once the Claude Code subagents are wired up in Phase 2, this content is replaced by real research and analysis.

## Executive summary

- The full pipeline (Postgres → Next.js Route Handler → MDX render) is operational.
- The data model in `infra/postgres/init.sql` matches the Zod schemas in `web/lib/schemas.ts`.
- Subagent definitions land in `.claude/agents/` next.

## What changed this week

No real events. Phase 2 populates this section from the `events` table.

## Methodology & sources

This stub bypasses the research and industry-expert agents. Real reports cite every claim with a primary source URL and retrieval timestamp.

---

*This is automated analysis, not legal advice. Consult qualified counsel before acting.*
$mdx$
)
ON CONFLICT (week_of, country, state) DO NOTHING;

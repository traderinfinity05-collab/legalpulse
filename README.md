# LegalPulse

Multi-agent legal intelligence platform. Monitors regulatory changes across the USA and India, analyses industry impact, publishes weekly McKinsey-style reports.

> **Status:** Phase 2b complete. Real subagents (research → industry-financial → documentation) write to Postgres; PDF generation + Supabase Storage upload populate `pdf_url`. India coverage and the other 7 industry experts arrive in Phase 3.

## Architecture

This project runs on a **Claude Code subscription**, not the Anthropic API. That shapes the architecture:

- **Agents are Claude Code subagents** — each lives in [.claude/agents/](.claude/agents/) as a markdown definition (research, industry experts, documentation). The orchestrator is a slash command in [.claude/commands/](.claude/commands/) that fans out to subagents via the `Agent` tool.
- **Weekly cron is a `/schedule` routine** — runs the orchestrator slash command on Sunday 02:00 UTC against the user's subscription. (GitHub Actions cron can't authenticate as a Claude Code subscription, so we don't use it for the pipeline. CI is for tests/typecheck/lint only.)
- **Next.js Route Handlers, no FastAPI** — `app/api/*` serves JSON directly from Postgres. Single deploy target (Netlify).
- **Supabase = Postgres + Storage + Auth** — one vendor covers the database (Phase 1), PDF storage (Phase 2b), and admin auth (Phase 4).
- **PDF via @react-pdf/renderer (no Chromium)** — pure JS, ~30 MB of deps, deploys anywhere Node runs.

## Quick start

Prereqs: Node 20+ (22 is fine).

### 1. Supabase setup

Create a project at https://supabase.com (free tier).

You need three values from the project's **Settings**:

| Where to find it | What it is | Goes into `.env` as |
|---|---|---|
| **Database** → Connection string → **Transaction pooler** (port 6543) | Postgres URL with your DB password | `DATABASE_URL` |
| **API** → Project URL | `https://<ref>.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| **API** → Project API keys → **service_role** (reveal it; treat as a secret) | Server-side key with full DB + Storage access | `SUPABASE_SERVICE_ROLE_KEY` |

> The `service_role` key bypasses Row-Level Security. Only used in server-side scripts (`pdf.tsx`, future admin endpoints). Never ship it to the browser.

### 2. Install + configure

```bash
cd web
cp .env.example .env
# fill in DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npx pnpm install
```

### 3. Schema + first seed

```bash
# still inside web/
npx pnpm db:migrate     # creates the legalpulse schema in Supabase
npx pnpm db:seed        # inserts a stub report so the site has something to render before the first real run
npx pnpm dev            # http://localhost:3000
```

Open http://localhost:3000 — the stub is on the landing page.

### 4. Run the real weekly pipeline

The pipeline lives as a Claude Code slash command. It needs subagents loaded, which happens at session start:

1. Open a fresh Claude Code session in the `legalpulse/` directory.
2. Run:

```
/weekly-pipeline
```

(or `/weekly-pipeline 2026-04-20` to back-fill a specific week — must be a Monday)

The orchestrator runs seven steps:

1. Resolve target week (most recent Monday in UTC if no arg).
2. **Research subagent** scans Federal Register / SEC / FTC for the week, dedupes, classifies by industry, writes `events.json`.
3. Persists events to `legalpulse.events`.
4. **industry-financial subagent** reads events tagged `Financial Services & Banking`, writes `analyses-financial.json` with severity / archetypes / cost / actions / second-order effects.
5. Persists analyses to `legalpulse.analyses`.
6. **Documentation subagent** composes the weekly report (markdown body + 3-bullet executive summary), writes `report-usa.json`.
7. **PDF generation** renders the report to PDF, uploads to the `legalpulse-pdfs` Supabase Storage bucket, sets `pdf_url`. Persists the report to `legalpulse.reports` (upsert by `(week_of, country, state)` — re-runs update, never duplicate).

Intermediate JSON artifacts live in `.pipeline/<week_of>/` (gitignored). Inspect them when debugging a failed run.

After a successful run, the report is live at `http://localhost:3000/reports/<slug>` and the **Download PDF** button on the detail page becomes active.

### Reset / re-run

- `npx pnpm db:reset` — drops public schema, re-runs init + seed (destructive: wipes legalpulse data)
- `/weekly-pipeline 2026-04-20` (re-run same week) — idempotent: events dedupe by `content_hash`; analyses upsert by `(event, industry)`; report upserts by `(week_of, country, state)`

## Layout

```
legalpulse/
├── .claude/
│   ├── agents/
│   │   ├── research.md             # USA sources → LegalChangeEvent[]
│   │   ├── industry-financial.md   # FS & Banking → ImpactAnalysis[]
│   │   └── documentation.md        # everything → WeeklyReport (MDX + meta)
│   └── commands/
│       └── weekly-pipeline.md      # orchestrator (the slash command you run)
├── infra/
│   └── postgres/
│       ├── init.sql                # full schema for fresh installs
│       ├── seed.sql                # Phase 1 stub (delete after first real run)
│       └── migrations/
│           └── 002_contact_messages.sql  # incremental migrations land here
├── web/
│   ├── app/                        # Next.js 15 App Router (frontend + API)
│   ├── lib/
│   │   ├── db.ts                   # postgres.js client, search_path-scoped to legalpulse
│   │   ├── repository.ts           # Zod-validated DB queries
│   │   └── schemas.ts               # Zod schemas (mirrors persist.mjs)
│   └── scripts/
│       ├── migrate.mjs              # SQL runner — pnpm db:migrate/seed/reset/apply
│       ├── persist.mjs              # pipeline persistence — events / analyses / report
│       └── pdf.tsx                  # markdown → PDF → Supabase Storage
├── .pipeline/                      # gitignored — per-week intermediate artifacts
├── .env.example
└── README.md
```

## Build phases

- **Phase 1 — Skeleton:** Postgres + seed + Next.js end-to-end. ✅
- **Phase 2a — Polish:** newsletter, contact, footer, regional filters, PDF download UI. ✅
- **Phase 2b — Real agents:** research + financial-services + documentation + PDF + Storage. ✅
- **Phase 3 — Scale-out:** all 8 industry agents, India coverage, `/schedule` routine for cron, Netlify deploy.
- **Phase 4 — Hardening:** tests, monitoring, admin dashboard, SEO (sitemaps, OG images), perf (Lighthouse 95+).

## Conventions

- Node 20+, TypeScript strict, `pnpm` (via `npx pnpm` or `corepack`).
- Subagent prompts are first-class artifacts — kept as version-controlled markdown.
- Comment the *why*, not the *what*.

## Quality bars (enforced at the agent prompt level + persistence schema)

1. Citations on every factual claim (URL + ISO retrieval timestamp).
2. Copyright safety: ≤30 words verbatim; paraphrase by default.
3. No hallucinated regulators — agents drop unverified claims rather than guess.
4. Idempotent: re-running on the same `(week, country, state)` updates rows, never duplicates.
5. Type-safe end to end: Zod at every boundary (route handlers, persistence script, agent → JSON file → DB).
6. Disclaimers on every report: *"This is automated analysis, not legal advice. Consult qualified counsel before acting."*

## Disclaimer

This is automated analysis, not legal advice. Consult qualified counsel before acting.

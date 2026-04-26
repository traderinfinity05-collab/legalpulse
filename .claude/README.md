# Claude Code workspace

This directory holds the **agent layer** for LegalPulse. Phase 1 ships only placeholders; Phase 2 fills them in.

## Layout

```
.claude/
├── agents/         # Subagent definitions — one .md per agent
│   ├── research.md           (Phase 2)
│   ├── industry-financial.md (Phase 2)
│   ├── industry-tech.md      (Phase 3)
│   │   ... 6 more industry agents in Phase 3
│   └── documentation.md      (Phase 2)
└── commands/       # Slash commands — orchestration entry points
    └── weekly-pipeline.md    (Phase 2)
```

## How the pipeline runs

1. **Trigger:** a `/schedule` routine fires `/weekly-pipeline` every Sunday 02:00 UTC. (Local development: invoke `/weekly-pipeline` manually inside a Claude Code session.)
2. **Orchestration:** the slash command coordinates subagents — research → fan-out to industry experts in parallel → reduce to documentation agent → write to Postgres.
3. **Persistence:** each subagent writes to Postgres via `psql` (Bash) or a small Node helper. Idempotency key: `(week_of, country, state)` — re-runs in the same week update the existing report rather than duplicating.
4. **Auth:** the routine uses the user's Claude Code subscription. No API key. The Postgres URL must be reachable from wherever the routine runs (managed Postgres in Phase 3 — Neon recommended).

## Why subagents instead of Python + Anthropic SDK

The original LegalPulse spec assumed `anthropic` API calls. We pivoted because the user has a Claude Code subscription, not API access. Subagents:
- Use the user's existing subscription auth — no API billing.
- Are version-controllable as plain markdown (the prompt is the artifact).
- Can be invoked from any Claude Code session, including scheduled routines.

The data model, quality bars (citations, copyright, idempotency, disclaimers), and frontend are unchanged from the original spec.

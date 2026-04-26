---
description: Run the LegalPulse weekly pipeline — research → industry experts → documentation → PDF + storage → publish to Postgres. Pass an optional YYYY-MM-DD argument to override the week-of (defaults to the most recent Monday). Example — `/weekly-pipeline 2026-04-20`.
argument-hint: "[week_of YYYY-MM-DD, defaults to most recent Monday]"
---

# Weekly pipeline — LegalPulse

You are orchestrating the full LegalPulse weekly run. Be sequential. Surface every persistence step's output to the user. Do not silently swallow failures: if a step errors, stop and report — never plough through with partial data.

Phase 2b scope: USA only. Financial Services & Banking is the only industry expert wired up; other industries land in Phase 3. India coverage is Phase 3.

## Step 0 — Determine the target week

If `$ARGUMENTS` is non-empty, parse it as a YYYY-MM-DD Monday and use that as `WEEK_OF`. Otherwise compute the most recent Monday in UTC:

```bash
WEEK_OF=$(date -u -v-Mon +%Y-%m-%d 2>/dev/null || date -u -d 'last monday' +%Y-%m-%d)
echo "WEEK_OF=$WEEK_OF"
```

Sanity-check: it must be a Monday and within the last ~14 days. If not, ask the user to confirm before continuing.

```bash
mkdir -p ".pipeline/$WEEK_OF"
```

## Step 1 — Research

Spawn the **research** subagent with this prompt:

> Run the research agent for week_of=$WEEK_OF. Write events to `.pipeline/$WEEK_OF/events.json`. Follow every constraint in your system prompt — primary `.gov` sources only, no verbatim copying beyond ~30 words, dedupe by content_hash, drop unverifiable claims.

Wait for it to finish. Verify the artifact:

```bash
test -s ".pipeline/$WEEK_OF/events.json" || { echo "✗ research produced no events.json"; exit 1; }
node -e "const a=JSON.parse(require('fs').readFileSync('.pipeline/$WEEK_OF/events.json','utf8')); if(!Array.isArray(a)) throw 'not an array'; console.log('events parsed:', a.length);"
```

If zero events, surface that and ask the user whether to continue (a thin week is legitimate but unusual).

## Step 2 — Persist events

```bash
cd web && npx pnpm pipeline:persist events "../.pipeline/$WEEK_OF/events.json" && cd ..
```

Capture the output — `events_inserted` and `events_skipped_dup`.

## Step 3 — Filter events for the Financial Services agent

The industry agent only reads its own scope. Filter the full events list to those tagged `Financial Services & Banking` and write a separate file:

```bash
node -e "
const fs=require('fs');
const all=JSON.parse(fs.readFileSync('.pipeline/$WEEK_OF/events.json','utf8'));
const fs_events=all.filter(e=>(e.industries||[]).includes('Financial Services & Banking') && e.country==='USA');
fs.writeFileSync('.pipeline/$WEEK_OF/events-financial.json', JSON.stringify(fs_events,null,2));
console.log('financial events:', fs_events.length);
"
```

If zero financial events, **skip Step 4** (no analyses to run) and note it in the final summary. Continue to Step 5 — the documentation agent will write a sparse but truthful report.

## Step 4 — Industry analysis (Financial Services)

Spawn the **industry-financial** subagent with this prompt:

> Run the Financial Services & Banking impact analysis for week_of=$WEEK_OF. Read `.pipeline/$WEEK_OF/events-financial.json`. Write analyses to `.pipeline/$WEEK_OF/analyses-financial.json`, one per input event. Follow every constraint in your system prompt — concrete recommended actions, second-order effects with substance, citations on every analysis.

Verify:

```bash
test -s ".pipeline/$WEEK_OF/analyses-financial.json" || { echo "✗ industry-financial produced no analyses"; exit 1; }
node -e "
const a=JSON.parse(require('fs').readFileSync('.pipeline/$WEEK_OF/analyses-financial.json','utf8'));
const e=JSON.parse(require('fs').readFileSync('.pipeline/$WEEK_OF/events-financial.json','utf8'));
if(!Array.isArray(a)) throw 'not an array';
if(a.length !== e.length) throw 'analysis count != event count: '+a.length+' vs '+e.length;
console.log('analyses parsed:', a.length);
"
```

Persist:

```bash
cd web && npx pnpm pipeline:persist analyses "../.pipeline/$WEEK_OF/analyses-financial.json" && cd ..
```

## Step 5 — Documentation (USA report)

Determine which analyses files exist:

```bash
ANALYSES_FILES=$(ls .pipeline/$WEEK_OF/analyses-*.json 2>/dev/null | tr '\n' ',' | sed 's/,$//')
echo "ANALYSES_FILES=$ANALYSES_FILES"
```

Spawn the **documentation** subagent with this prompt:

> Run the documentation agent for week_of=$WEEK_OF, country=USA. Read `.pipeline/$WEEK_OF/events.json` and these analyses files: $ANALYSES_FILES. Write the report to `.pipeline/$WEEK_OF/report-usa.json`. Follow every constraint — McKinsey tone, citations everywhere, exactly 3 executive-summary bullets, all six required section headings, 800-1500 word body. If no analyses exist for any industry this week, write an honest sparse report rather than fabricating content.

Verify:

```bash
test -s ".pipeline/$WEEK_OF/report-usa.json" || { echo "✗ documentation produced no report"; exit 1; }
node -e "
const r=JSON.parse(require('fs').readFileSync('.pipeline/$WEEK_OF/report-usa.json','utf8'));
if(!r.slug || !r.mdx_content || !Array.isArray(r.executive_summary)) throw 'invalid report shape';
if(r.executive_summary.length !== 3) throw 'executive_summary must have 3 bullets, got '+r.executive_summary.length;
const wc = r.mdx_content.split(/\s+/).filter(Boolean).length;
console.log('report parsed: slug='+r.slug+', words='+wc);
if(wc < 600 || wc > 2000) console.warn('! word count '+wc+' outside expected 800-1500 range');
"
```

## Step 6 — PDF generation + Supabase Storage upload

Renders the markdown body to a PDF (no Chromium dep) and uploads to the `legalpulse-pdfs` bucket. Updates the report JSON file in place with `pdf_url`.

```bash
cd web && npx tsx --env-file=.env scripts/pdf.tsx ../.pipeline/$WEEK_OF/report-usa.json && cd ..
```

If this fails because `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL` is unset: tell the user, then continue to Step 7 with `pdf_url` left as null. The report still publishes; the "Download PDF" button stays disabled until they fix the env.

## Step 7 — Persist report (with pdf_url)

```bash
cd web && npx pnpm pipeline:persist report "../.pipeline/$WEEK_OF/report-usa.json" && cd ..
```

This upserts on `(week_of, country, state)`. Re-running the same week updates the existing row instead of creating a duplicate.

## Final summary

Print a structured summary to the user:

- **WEEK_OF** = $WEEK_OF
- **Events**: inserted X, skipped Y (dups)
- **Financial Services analyses**: inserted/updated N
- **Report**: <slug>, <word count> words, <inserted|updated>
- **PDF**: <url or "not generated — service-role key missing">
- **Live at**: http://localhost:3000/reports/<slug>
- **Pipeline cache**: `.pipeline/$WEEK_OF/` (intermediate artifacts; gitignored)

If the user has the dev server running, suggest they hit the URL above to see the published report.

## Quality bars (apply to every step)

1. **Citations on every claim.** Each agent enforces this internally; you trust + verify the artifact files parse and meet the structural requirements.
2. **Idempotency.** Re-running on the same `$WEEK_OF` must not duplicate rows. The persist script enforces this via `ON CONFLICT`. If you see surprising counts, investigate before proceeding.
3. **No silent failures.** A failed step halts the pipeline. Surface the error verbatim — never paper over it with partial data.
4. **Honest scope.** If the research agent returns zero events, the documentation agent should still write *something*, but that something must clearly state "no material changes this week" rather than fabricating activity.

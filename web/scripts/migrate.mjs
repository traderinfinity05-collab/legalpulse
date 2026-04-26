// One-shot migration runner. Reads infra/postgres/*.sql and applies them
// against $DATABASE_URL using the postgres.js client we already depend on.
//
// Usage:
//   pnpm db:migrate              → applies init.sql (schema)
//   pnpm db:seed                 → applies seed.sql (stub report; idempotent)
//   pnpm db:reset                → drops public schema, then init + seed
//   pnpm db:apply <path>         → applies an arbitrary SQL file (incremental migrations)
//
// Why a Node script instead of psql: zero extra install. postgres.js can run
// arbitrary SQL via sql.unsafe(). The Postgres connection string is the only
// thing the user needs to provide.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and paste your Supabase pooler connection string.");
  process.exit(1);
}

const action = process.argv[2] ?? "migrate";
const sql = postgres(url, { max: 1, onnotice: () => {} });

async function applyFile(relPath) {
  const full = resolve(REPO_ROOT, relPath);
  const body = readFileSync(full, "utf8");
  console.log(`→ applying ${relPath}`);
  await sql.unsafe(body);
}

try {
  if (action === "reset") {
    console.log("→ dropping public schema");
    await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    await applyFile("infra/postgres/init.sql");
    await applyFile("infra/postgres/seed.sql");
  } else if (action === "seed") {
    await applyFile("infra/postgres/seed.sql");
  } else if (action === "apply") {
    const path = process.argv[3];
    if (!path) {
      console.error("usage: migrate.mjs apply <path-relative-to-repo-root>");
      process.exit(1);
    }
    await applyFile(path);
  } else {
    await applyFile("infra/postgres/init.sql");
  }
  console.log("✓ done");
} catch (err) {
  console.error("✗ migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

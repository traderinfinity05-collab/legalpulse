import postgres, { type Sql } from "postgres";

// Lazy singleton: don't open a pool (or even read DATABASE_URL) until the
// first query. Two reasons:
//   1. Next.js imports route handlers during `next build`'s page-data step
//      before runtime env vars exist — eager init would fail the build.
//   2. globalThis cache survives Next.js dev hot-reloads, preventing the
//      "too many connections" error after a few file saves.

declare global {
  // eslint-disable-next-line no-var
  var __pg: Sql | undefined;
}

let cached: Sql | undefined;

export function getSql(): Sql {
  if (globalThis.__pg) return globalThis.__pg;
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }

  // search_path scopes every query to the legalpulse schema. The same
  // Supabase project also hosts nifty50-pulse — schema isolation keeps the
  // two products from referencing each other's tables by accident.
  const client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { search_path: "legalpulse,public" },
  });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__pg = client;
  } else {
    cached = client;
  }
  return client;
}

import { createHash } from "node:crypto";
import { getSql } from "./db";
import {
  ContactMessageInput,
  NewsletterSignupInput,
  ReportSummary,
  WeeklyReport,
} from "./schemas";

// Thin DB layer. Validates everything coming back through Zod so a schema
// drift between Postgres and the TS types fails loudly at the boundary
// instead of silently rendering bad data.

type ListFilters = {
  country?: "USA" | "INDIA";
  state?: string;
  limit?: number;
};

export async function listReports(filters: ListFilters = {}): Promise<ReportSummary[]> {
  const sql = getSql();
  const limit = Math.min(filters.limit ?? 24, 100);
  const rows = await sql`
    SELECT
      id, slug, week_of, country, state, title,
      executive_summary, pdf_url, generated_at
    FROM legalpulse.reports
    WHERE
      (${filters.country ?? null}::text IS NULL OR country = ${filters.country ?? null})
      AND (${filters.state ?? null}::text IS NULL OR state = ${filters.state ?? null})
    ORDER BY week_of DESC, country
    LIMIT ${limit}
  `;
  return rows.map((r) =>
    ReportSummary.parse({
      ...r,
      week_of: r.week_of instanceof Date ? r.week_of.toISOString().slice(0, 10) : r.week_of,
      generated_at:
        r.generated_at instanceof Date ? r.generated_at.toISOString() : r.generated_at,
    }),
  );
}

export async function getReportBySlug(slug: string): Promise<WeeklyReport | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id, slug, week_of, country, state, title,
      executive_summary, mdx_content, pdf_url, generated_at
    FROM legalpulse.reports
    WHERE slug = ${slug}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return WeeklyReport.parse({
    ...r,
    week_of: r.week_of instanceof Date ? r.week_of.toISOString().slice(0, 10) : r.week_of,
    generated_at:
      r.generated_at instanceof Date ? r.generated_at.toISOString() : r.generated_at,
  });
}

// ─── newsletter ────────────────────────────────────────────────────────

export type NewsletterResult = "created" | "already_subscribed";

export async function subscribeNewsletter(
  input: NewsletterSignupInput,
): Promise<NewsletterResult> {
  const sql = getSql();
  const email = input.email.trim().toLowerCase();
  const rows = await sql`
    INSERT INTO legalpulse.newsletter_signups (email)
    VALUES (${email})
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0 ? "created" : "already_subscribed";
}

// ─── contact ───────────────────────────────────────────────────────────

// SHA-256 of IP — Phase 4 will use this for rate-limit dedupe. We never
// store the raw IP (privacy: nothing recoverable in a DB leak).
function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export async function createContactMessage(
  input: ContactMessageInput,
  meta: { userAgent: string | null; ip: string | null },
): Promise<{ id: string }> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO legalpulse.contact_messages (name, email, message, user_agent, ip_hash)
    VALUES (
      ${input.name.trim()},
      ${input.email.trim().toLowerCase()},
      ${input.message.trim()},
      ${meta.userAgent},
      ${hashIp(meta.ip)}
    )
    RETURNING id
  `;
  return { id: rows[0].id };
}

import { z } from "zod";

// Single source of truth for the data model on the TS side. Keep these in
// sync with infra/postgres/init.sql by hand for now — Phase 4 generates
// both from a JSON Schema source.

export const Country = z.enum(["USA", "INDIA"]);
export type Country = z.infer<typeof Country>;

export const SourceType = z.enum(["regulator", "court", "legislature", "social"]);
export const Severity = z.enum(["low", "medium", "high", "critical"]);
export const CostBand = z.enum(["<$100K", "$100K-$1M", "$1M-$10M", ">$10M", "unknown"]);

export const Citation = z.object({
  url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

export const LegalChangeEvent = z.object({
  id: z.string().uuid(),
  country: Country,
  state: z.string().nullable(),
  source_url: z.string().url(),
  source_type: SourceType,
  title: z.string(),
  summary: z.string().max(2000),
  raw_excerpt: z.string(),
  effective_date: z.string().nullable(),
  detected_at: z.string().datetime(),
  industries: z.array(z.string()),
  content_hash: z.string(),
});
export type LegalChangeEvent = z.infer<typeof LegalChangeEvent>;

export const ImpactAnalysis = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  industry: z.string(),
  severity: Severity,
  affected_archetypes: z.array(z.string()),
  time_to_comply_days: z.number().int().nullable(),
  cost_band: CostBand,
  recommended_actions: z.array(z.string()),
  second_order_effects: z.array(z.string()),
  citations: z.array(Citation),
});
export type ImpactAnalysis = z.infer<typeof ImpactAnalysis>;

export const WeeklyReport = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  week_of: z.string(),                // ISO date (YYYY-MM-DD)
  country: Country,
  state: z.string().nullable(),
  title: z.string(),
  executive_summary: z.array(z.string()),
  mdx_content: z.string(),
  pdf_url: z.string().url().nullable(),
  generated_at: z.string().datetime(),
});
export type WeeklyReport = z.infer<typeof WeeklyReport>;

export const ReportSummary = WeeklyReport.omit({ mdx_content: true });
export type ReportSummary = z.infer<typeof ReportSummary>;

// ─── form payloads ─────────────────────────────────────────────────────
// Used by client forms and validated again on the server side.

export const NewsletterSignupInput = z.object({
  email: z.string().email("Please enter a valid email address.").max(254),
});
export type NewsletterSignupInput = z.infer<typeof NewsletterSignupInput>;

export const ContactMessageInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().email("Please enter a valid email address.").max(254),
  message: z.string().trim().min(10, "Message is too short.").max(4000),
  // Honeypot field — accept anything (so bots' bogus values pass parse), then
  // the handler silently 200's any non-empty value without writing to DB.
  // Hidden via CSS so legitimate browsers leave it untouched.
  honeypot: z.string().optional(),
});
export type ContactMessageInput = z.infer<typeof ContactMessageInput>;

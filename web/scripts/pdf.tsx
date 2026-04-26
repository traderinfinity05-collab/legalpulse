// PDF generation + Supabase Storage upload for the weekly pipeline.
// Reads .pipeline/<week>/report-<country>.json, renders a print-quality
// PDF with @react-pdf/renderer (no Chromium dep), uploads to the
// `legalpulse-pdfs` bucket, and writes the public URL back into the
// report JSON file. The orchestrator then re-runs persist.mjs report
// to update reports.pdf_url in Postgres.
//
// Usage (from web/, with .env loaded):
//   tsx --env-file=.env scripts/pdf.tsx ../.pipeline/2026-04-20/report-usa.json
//
// Why this rather than Puppeteer: @react-pdf/renderer is pure JS, ~30 MB
// of deps, deploys anywhere Node runs (including Anthropic's scheduled-
// routine infra). Visual fidelity is lower than browser print, but the
// output is small, deterministic, and the typography matches the brief.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent } from "mdast";

// ─── Type for the report JSON we read & write ───────────────────────────

type ReportFile = {
  slug: string;
  week_of: string;
  country: "USA" | "INDIA";
  state: string | null;
  title: string;
  executive_summary: string[];
  mdx_content: string;
  pdf_url: string | null;
  event_content_hashes?: string[];
  analysis_keys?: { content_hash: string; industry: string }[];
};

// ─── Env

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env to upload PDFs.",
  );
  console.error(
    "Find both in: https://supabase.com/dashboard/project/<ref>/settings/api",
  );
  process.exit(1);
}
if (!databaseUrl) {
  console.warn(
    "(DATABASE_URL not set — that's fine for this script, but persist.mjs will need it next.)",
  );
}

const BUCKET = "legalpulse-pdfs";

// ─── Typography (the font is shipped with @react-pdf/renderer's fallback;
// we don't register custom fonts to keep dependencies minimal).

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: "Times-Roman",
    fontSize: 11,
    color: "#0A0A0A",
    backgroundColor: "#FAFAF7",
    lineHeight: 1.55,
  },
  header: {
    borderBottom: "0.5px solid #C5C2BA",
    paddingBottom: 8,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#5C5A52",
    fontFamily: "Helvetica",
  },
  countryBadge: {
    fontSize: 8,
    letterSpacing: 1.4,
    color: "#FAFAF7",
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
  },
  meta: {
    fontSize: 9,
    color: "#5C5A52",
    fontFamily: "Helvetica",
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 24,
    lineHeight: 1.15,
    marginBottom: 24,
  },
  execList: {
    marginTop: 4,
    marginBottom: 28,
    borderLeft: "1px solid #C5C2BA",
    paddingLeft: 14,
  },
  execBullet: {
    fontSize: 12,
    fontFamily: "Times-Roman",
    color: "#0A0A0A",
    marginBottom: 8,
    lineHeight: 1.45,
  },
  h1: {
    fontFamily: "Times-Bold",
    fontSize: 18,
    marginTop: 22,
    marginBottom: 10,
  },
  h2: {
    fontFamily: "Times-Bold",
    fontSize: 14,
    marginTop: 18,
    marginBottom: 8,
  },
  h3: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 8,
  },
  blockquote: {
    borderLeft: "2px solid #C5C2BA",
    paddingLeft: 10,
    marginVertical: 10,
    color: "#5C5A52",
    fontStyle: "italic",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 10,
  },
  bullet: {
    width: 14,
    color: "#5C5A52",
  },
  link: {
    color: "#1B3A6B",
    textDecoration: "underline",
  },
  bold: {
    fontFamily: "Times-Bold",
  },
  italic: {
    fontStyle: "italic",
  },
  code: {
    fontFamily: "Courier",
    fontSize: 10,
    backgroundColor: "#F0EFE9",
    paddingHorizontal: 3,
  },
  table: {
    marginVertical: 10,
    borderTop: "0.5px solid #C5C2BA",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #C5C2BA",
    paddingVertical: 6,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 4,
    fontSize: 9.5,
  },
  tableHeaderCell: {
    flex: 1,
    paddingHorizontal: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#5C5A52",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 56,
    right: 56,
    fontSize: 8,
    color: "#5C5A52",
    fontFamily: "Helvetica",
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "0.5px solid #C5C2BA",
    paddingTop: 8,
  },
});

// ─── mdast → react-pdf walker ───────────────────────────────────────────
// Markdown features supported: h1-h3, paragraphs, blockquotes, lists,
// tables (GFM), inline strong/em/inlineCode/link. Everything else is
// rendered as plain text. That covers the structure the documentation
// agent is instructed to produce.

type InlineNode = RootContent | { type: string; [k: string]: unknown };

function renderInline(nodes: InlineNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((n: any, i: number) => {
    const key = `${keyPrefix}-${i}`;
    switch (n.type) {
      case "text":
        return <Text key={key}>{n.value}</Text>;
      case "strong":
        return (
          <Text key={key} style={styles.bold}>
            {renderInline(n.children, key)}
          </Text>
        );
      case "emphasis":
        return (
          <Text key={key} style={styles.italic}>
            {renderInline(n.children, key)}
          </Text>
        );
      case "inlineCode":
        return (
          <Text key={key} style={styles.code}>
            {n.value}
          </Text>
        );
      case "link": {
        // @react-pdf/renderer's <Link src=...> renders a clickable link in
        // the PDF. Children are still rendered as styled Text inside it.
        const childText = renderInline(n.children, key);
        return (
          <Link key={key} src={n.url} style={styles.link}>
            {childText}
          </Link>
        );
      }
      case "break":
        return <Text key={key}>{"\n"}</Text>;
      default:
        // Fallback: try to render any children as text.
        if (Array.isArray(n.children)) return renderInline(n.children, key);
        if (typeof n.value === "string") return <Text key={key}>{n.value}</Text>;
        return null;
    }
  });
}

function renderBlock(node: any, keyPrefix: string): React.ReactNode {
  switch (node.type) {
    case "heading": {
      const style =
        node.depth === 1 ? styles.h1 : node.depth === 2 ? styles.h2 : styles.h3;
      return (
        <Text key={keyPrefix} style={style}>
          {renderInline(node.children, keyPrefix)}
        </Text>
      );
    }
    case "paragraph":
      return (
        <Text key={keyPrefix} style={styles.paragraph}>
          {renderInline(node.children, keyPrefix)}
        </Text>
      );
    case "blockquote":
      return (
        <View key={keyPrefix} style={styles.blockquote}>
          {node.children.map((c: any, i: number) =>
            renderBlock(c, `${keyPrefix}-bq-${i}`),
          )}
        </View>
      );
    case "list":
      return (
        <View key={keyPrefix} style={{ marginBottom: 8 }}>
          {node.children.map((item: any, i: number) => (
            <View key={`${keyPrefix}-li-${i}`} style={styles.listItem}>
              <Text style={styles.bullet}>{node.ordered ? `${i + 1}.` : "·"}</Text>
              <View style={{ flex: 1 }}>
                {item.children.map((c: any, j: number) =>
                  renderBlock(c, `${keyPrefix}-li-${i}-${j}`),
                )}
              </View>
            </View>
          ))}
        </View>
      );
    case "table": {
      // GFM table: first row is header.
      const [headerRow, ...bodyRows] = node.children;
      return (
        <View key={keyPrefix} style={styles.table} wrap={false}>
          <View style={styles.tableRow}>
            {headerRow.children.map((cell: any, i: number) => (
              <Text key={i} style={styles.tableHeaderCell}>
                {renderInline(cell.children, `${keyPrefix}-th-${i}`)}
              </Text>
            ))}
          </View>
          {bodyRows.map((row: any, ri: number) => (
            <View key={ri} style={styles.tableRow}>
              {row.children.map((cell: any, ci: number) => (
                <Text key={ci} style={styles.tableCell}>
                  {renderInline(cell.children, `${keyPrefix}-td-${ri}-${ci}`)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case "thematicBreak":
      return (
        <View
          key={keyPrefix}
          style={{ borderTop: "0.5px solid #C5C2BA", marginVertical: 12 }}
        />
      );
    case "code":
      return (
        <Text key={keyPrefix} style={[styles.code, { marginBottom: 8 }]}>
          {node.value}
        </Text>
      );
    default:
      return null;
  }
}

// ─── Document composition ──────────────────────────────────────────────

function ReportPDF({ report }: { report: ReportFile }) {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(report.mdx_content) as Root;

  const countryLabel =
    report.country === "USA" ? "United States" : "India";
  const accent = report.country === "USA" ? "#1B3A6B" : "#C8651B";

  return (
    <Document
      title={report.title}
      author="LegalPulse"
      subject={`Weekly legal intelligence — ${countryLabel} — week of ${report.week_of}`}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header} fixed>
          <Text>LegalPulse</Text>
          <Text>Week of {report.week_of}</Text>
        </View>

        <View style={{ marginBottom: 6, flexDirection: "row" }}>
          <Text style={[styles.countryBadge, { backgroundColor: accent }]}>
            {countryLabel.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.meta}>
          Published {new Date().toISOString().slice(0, 10)} · Automated analysis,
          not legal advice
        </Text>

        <Text style={styles.title}>{report.title}</Text>

        {report.executive_summary.length > 0 && (
          <View style={styles.execList}>
            {report.executive_summary.map((bullet, i) => (
              <Text key={i} style={styles.execBullet}>
                {bullet}
              </Text>
            ))}
          </View>
        )}

        {tree.children.map((node, i) => renderBlock(node, `b-${i}`))}

        <View style={styles.footer} fixed>
          <Text>LegalPulse · legalpulse.com</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

// ─── Storage upload ────────────────────────────────────────────────────

// SupabaseClient<any, any, any> avoids the schema-generic mismatch you'd
// get from the default `createClient` return type — we don't care about
// the typed schema here, just the storage API.
async function ensureBucket(client: SupabaseClient<any, any, any>) {
  // Idempotent: createBucket returns an error if the bucket already exists,
  // which we tolerate. Public so the URLs we put in reports.pdf_url resolve
  // for any browser; PDFs are intended to be public artifacts.
  const { error } = await client.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 25 * 1024 * 1024,
  });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw error;
  }
}

async function uploadPDF(buf: Buffer, slug: string): Promise<string> {
  const client = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false },
  });
  await ensureBucket(client);

  const path = `${slug}.pdf`;
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "3600",
    });
  if (error) throw error;

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Entry ─────────────────────────────────────────────────────────────
// Wrapped in an async main because tsx targets CJS by default, which
// rejects top-level await. Don't replace this with top-level await
// without also setting up ESM output for tsx — easy to break.

async function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    console.error("usage: tsx scripts/pdf.tsx <path-to-report-json>");
    process.exit(1);
  }

  const fullPath = resolve(reportPath);
  const report = JSON.parse(readFileSync(fullPath, "utf8")) as ReportFile;

  console.log(`→ rendering PDF for ${report.slug}`);
  const buf = await renderToBuffer(<ReportPDF report={report} />);
  console.log(`  rendered ${(buf.length / 1024).toFixed(1)} KB`);

  console.log(`→ uploading to Supabase Storage bucket "${BUCKET}"`);
  const url = await uploadPDF(buf, report.slug);
  console.log(`  public URL: ${url}`);

  // Write the URL back into the report file so the next persist run picks it up.
  report.pdf_url = url;
  writeFileSync(fullPath, JSON.stringify(report, null, 2));
  console.log(`→ updated ${reportPath} with pdf_url`);
  console.log("✓ done");
}

main().catch((err) => {
  console.error("✗ pdf generation failed:", err.message ?? err);
  process.exit(1);
});

import Link from "next/link";
import { listReports } from "@/lib/repository";
import { CountryBadge } from "./_components/country-badge";

// Force dynamic rendering for now — Phase 1 has only one report so caching
// is irrelevant, and dynamic keeps the dev experience predictable. Phase 4
// adds ISR with revalidateTag on pipeline completion.
export const dynamic = "force-dynamic";

const INDUSTRIES = [
  "Financial Services & Banking",
  "Technology & Data Privacy",
  "Healthcare & Pharma",
  "Energy & Utilities",
  "Manufacturing & Supply Chain",
  "Retail & Consumer Goods",
  "Real Estate & Construction",
  "Telecom & Media",
];

export default async function Home() {
  const reports = await listReports({ limit: 7 });
  const featured = reports[0];
  const rest = reports.slice(1);

  return (
    <div className="space-y-24">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-10 pt-4">
        <div className="md:col-span-8">
          <p className="text-xs uppercase tracking-widest text-muted mb-5">
            This week
          </p>
          {featured ? (
            <>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
                <Link
                  href={`/reports/${featured.slug}`}
                  className="hover:underline underline-offset-[6px] decoration-1"
                >
                  {featured.title}
                </Link>
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
                <CountryBadge country={featured.country} />
                <span>·</span>
                <time dateTime={featured.week_of}>Week of {featured.week_of}</time>
              </div>
              {featured.executive_summary[0] && (
                <p className="mt-8 text-lg leading-relaxed text-ink/80 max-w-prose font-serif">
                  {featured.executive_summary[0]}
                </p>
              )}
              <Link
                href={`/reports/${featured.slug}`}
                className="inline-block mt-10 text-sm border border-ink px-6 py-2.5 hover:bg-ink hover:text-paper transition-colors"
              >
                Read the report →
              </Link>
            </>
          ) : (
            <h1 className="font-serif text-4xl md:text-5xl leading-tight">
              Awaiting first weekly report.
            </h1>
          )}
        </div>

        <aside className="md:col-span-4 md:border-l md:border-rule md:pl-10">
          <p className="text-xs uppercase tracking-widest text-muted mb-4">
            Why LegalPulse
          </p>
          <p className="text-sm leading-relaxed text-ink/80">
            We monitor regulators, courts, and legislatures in the U.S. and
            India every week, and translate the changes into industry-specific
            impact: severity, cost band, time to comply, second-order effects.
          </p>
          <p className="text-sm leading-relaxed text-ink/80 mt-4">
            For operators and counsel who need signal — not 200 pages of
            <code className="mx-1">federalregister.gov</code>.
          </p>
          <Link
            href="/methodology"
            className="inline-block mt-6 text-sm underline underline-offset-4 hover:text-muted"
          >
            How it works →
          </Link>
        </aside>
      </section>

      {/* ── Latest reports ────────────────────────────────────────────── */}
      {rest.length > 0 && (
        <section className="border-t border-rule pt-12">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="font-serif text-2xl">Latest</h2>
            <Link
              href="/reports"
              className="text-sm text-muted hover:text-ink underline underline-offset-4"
            >
              All reports →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {rest.map((r) => (
              <Link
                key={r.id}
                href={`/reports/${r.slug}`}
                className="group block"
              >
                <CountryBadge country={r.country} />
                <h3 className="font-serif text-xl mt-4 mb-2 leading-snug group-hover:underline underline-offset-4 decoration-1">
                  {r.title}
                </h3>
                <time className="text-xs text-muted" dateTime={r.week_of}>
                  Week of {r.week_of}
                </time>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Browse by region ──────────────────────────────────────────── */}
      <section className="border-t border-rule pt-12">
        <h2 className="font-serif text-2xl mb-8">Browse by region</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/reports?country=USA"
            className="group block border border-rule hover:border-ink transition-colors p-8"
          >
            <p className="text-xs uppercase tracking-widest text-muted mb-3">Country</p>
            <p className="font-serif text-3xl mb-1 group-hover:underline underline-offset-4 decoration-1">
              United States
            </p>
            <p className="text-sm text-muted">Federal + four states (CA, NY, TX, FL)</p>
          </Link>
          <Link
            href="/reports?country=INDIA"
            className="group block border border-rule hover:border-ink transition-colors p-8"
          >
            <p className="text-xs uppercase tracking-widest text-muted mb-3">Country</p>
            <p className="font-serif text-3xl mb-1 group-hover:underline underline-offset-4 decoration-1">
              India
            </p>
            <p className="text-sm text-muted">Centre + capital-markets, RBI, MeitY</p>
          </Link>
        </div>
      </section>

      {/* ── Browse by industry ────────────────────────────────────────── */}
      <section className="border-t border-rule pt-12">
        <h2 className="font-serif text-2xl mb-8">Browse by industry</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
          {INDUSTRIES.map((industry) => (
            <li key={industry}>
              <span className="text-sm text-muted cursor-not-allowed" title="Coming with first weekly report">
                {industry}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted">
          Industry filtering activates with the first published report.
        </p>
      </section>
    </div>
  );
}

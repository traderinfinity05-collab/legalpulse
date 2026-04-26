import Link from "next/link";
import { listReports } from "@/lib/repository";
import { CountryBadge } from "../_components/country-badge";

export const dynamic = "force-dynamic";

type Search = { country?: string };

export default async function ReportsIndex({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { country } = await searchParams;
  const filter =
    country === "USA" || country === "INDIA" ? country : undefined;
  const reports = await listReports({ limit: 50, country: filter });

  return (
    <div className="max-w-4xl">
      <h1 className="font-serif text-4xl mb-3">Reports</h1>
      <p className="text-muted mb-10 max-w-prose">
        Weekly intelligence on regulatory and legal change in the United States
        and India.
      </p>

      <nav className="flex gap-2 mb-10 text-xs uppercase tracking-widest">
        <FilterPill href="/reports" active={!filter}>
          All
        </FilterPill>
        <FilterPill href="/reports?country=USA" active={filter === "USA"}>
          United States
        </FilterPill>
        <FilterPill href="/reports?country=INDIA" active={filter === "INDIA"}>
          India
        </FilterPill>
      </nav>

      {reports.length === 0 ? (
        <p className="text-muted">No reports yet for this filter.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {reports.map((r) => (
            <li key={r.id} className="py-7">
              <Link href={`/reports/${r.slug}`} className="group block">
                <div className="flex items-center gap-3 mb-2">
                  <CountryBadge country={r.country} />
                  <time className="text-xs text-muted" dateTime={r.week_of}>
                    Week of {r.week_of}
                  </time>
                </div>
                <h2 className="font-serif text-2xl group-hover:underline underline-offset-4 decoration-1 leading-snug">
                  {r.title}
                </h2>
                {r.executive_summary[0] && (
                  <p className="mt-2 text-muted max-w-prose">
                    {r.executive_summary[0]}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 border transition-colors ${
        active
          ? "border-ink bg-ink text-paper"
          : "border-rule text-muted hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

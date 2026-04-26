import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getReportBySlug } from "@/lib/repository";
import { CountryBadge } from "../../_components/country-badge";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const report = await getReportBySlug(slug);
  if (!report) return { title: "Not found" };
  return {
    title: report.title,
    description: report.executive_summary[0] ?? undefined,
  };
}

export default async function ReportDetail({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const report = await getReportBySlug(slug);
  if (!report) notFound();

  return (
    <article className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <header className="lg:col-span-12 pb-10 border-b border-rule">
        <div className="flex flex-wrap items-center gap-3 mb-5 text-sm">
          <CountryBadge country={report.country} />
          <span className="text-muted">·</span>
          <time className="text-muted" dateTime={report.week_of}>
            Week of {report.week_of}
          </time>
          <span className="text-muted">·</span>
          <span className="text-muted">
            Published{" "}
            {new Date(report.generated_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <h1 className="font-serif text-3xl md:text-5xl leading-[1.1] tracking-tight max-w-4xl">
          {report.title}
        </h1>

        {report.executive_summary.length > 0 && (
          <ul className="mt-10 space-y-3 max-w-3xl">
            {report.executive_summary.map((bullet, i) => (
              <li
                key={i}
                className="pl-5 border-l-2 border-rule font-serif text-lg leading-relaxed text-ink/80"
              >
                {bullet}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          {report.pdf_url ? (
            <a
              href={report.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm border border-ink px-5 py-2 hover:bg-ink hover:text-paper transition-colors"
            >
              <DownloadIcon />
              Download PDF
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-2 text-sm border border-rule px-5 py-2 text-muted cursor-not-allowed"
              title="PDF generation arrives with the first real report (Phase 2b)"
            >
              <DownloadIcon />
              PDF available with first report
            </span>
          )}
        </div>
      </header>

      <div className="lg:col-span-8 lg:col-start-3">
        <div className="prose-report">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {report.mdx_content}
          </ReactMarkdown>
        </div>
      </div>
    </article>
  );
}

function DownloadIcon() {
  // Inline SVG keeps the bundle clean — no icon-library dep for one glyph.
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
    </svg>
  );
}

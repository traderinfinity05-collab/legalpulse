import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — LegalPulse",
  description:
    "How LegalPulse covers regulatory and legal change in the United States and India.",
};

export default function AboutPage() {
  return (
    <article className="max-w-prose">
      <p className="text-xs uppercase tracking-widest text-muted mb-4">About</p>
      <h1 className="font-serif text-4xl leading-tight mb-8">
        Weekly legal intelligence, written by machine, audited by humans.
      </h1>

      <div className="prose-report">
        <p>
          LegalPulse monitors regulatory and legal change across the United
          States and India. Every Sunday, a pipeline of specialised AI agents
          ingests filings, court orders, and regulator announcements; classifies
          them by industry; assesses second-order effects; and publishes a
          consolidated weekly report.
        </p>
        <p>
          We built this for a specific reader: the operator or in-house counsel
          who needs to know <em>what changed and why it matters</em> without
          reading 200 pages of <code>federalregister.gov</code>. Reports are
          short, executive-toned, and ruthlessly cited.
        </p>
        <h2>What this is not</h2>
        <p>
          We are not a law firm. Nothing on this site is legal advice. Use it
          to spot what to dig into — then call counsel.
        </p>
        <p>
          We don&apos;t aim for completeness. We aim for signal: the changes
          that materially shift compliance, cost, or strategy for the eight
          industry verticals we track.
        </p>
        <h2>How to read a report</h2>
        <p>
          Each weekly report opens with a three-bullet executive summary, then
          walks through the week&apos;s changes chronologically, then breaks
          impact down by industry. Severity ratings, cost bands, and
          time-to-comply estimates are the agent&apos;s best assessment — not a
          guarantee. Every claim links to a primary source.
        </p>
      </div>
    </article>
  );
}

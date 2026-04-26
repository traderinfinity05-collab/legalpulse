import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — LegalPulse",
  description:
    "How LegalPulse research, classification, and impact analysis works.",
};

export default function MethodologyPage() {
  return (
    <article className="max-w-prose">
      <p className="text-xs uppercase tracking-widest text-muted mb-4">
        Methodology
      </p>
      <h1 className="font-serif text-4xl leading-tight mb-8">
        Pipeline, sources, and editorial standards.
      </h1>

      <div className="prose-report">
        <h2>Pipeline</h2>
        <p>
          A scheduled routine fires every Sunday at 02:00 UTC. The orchestrator
          spawns four specialised agents in sequence:
        </p>
        <ol>
          <li>
            <strong>Research</strong> — monitors a curated source list per
            country, deduplicates against the prior week, and emits a normalised
            list of legal-change events.
          </li>
          <li>
            <strong>Industry experts</strong> (eight, in parallel) — each
            receives only the events relevant to its vertical and produces an
            impact assessment: severity, affected company archetypes,
            time-to-comply, cost band, recommended actions, and second-order
            effects.
          </li>
          <li>
            <strong>Documentation</strong> — aggregates everything into a
            consolidated report per country and a per-industry deep dive.
            Outputs MDX for the website and PDF for download.
          </li>
        </ol>

        <h2>Editorial standards</h2>
        <ul>
          <li>
            <strong>Citations on every claim.</strong> A report section without
            a primary-source link is not published.
          </li>
          <li>
            <strong>Copyright safety.</strong> Verbatim quotes are limited to a
            sentence or two, with attribution. Everything else is paraphrased.
          </li>
          <li>
            <strong>No unverified regulators.</strong> If the research agent
            cannot verify a source against a primary site, the claim is dropped.
            We&apos;d rather have a thin section than a wrong one.
          </li>
          <li>
            <strong>Idempotent runs.</strong> Re-running the pipeline in the
            same week updates the existing report — never duplicates.
          </li>
        </ul>

        <h2>What we don&apos;t do</h2>
        <p>
          We do not currently cover state-level rulemaking comprehensively (USA
          coverage is initially CA / NY / TX / FL). We do not predict outcomes
          of pending litigation. We do not issue legal opinions.
        </p>

        <h2>Corrections</h2>
        <p>
          Spot a mistake?{" "}
          <a href="/contact">Tell us</a> and we&apos;ll fix it. We log
          corrections at the bottom of each affected report.
        </p>
      </div>
    </article>
  );
}

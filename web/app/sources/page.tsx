import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sources — LegalPulse",
  description: "The primary sources LegalPulse monitors weekly.",
};

const USA_SOURCES = [
  { name: "Federal Register", url: "https://www.federalregister.gov", note: "Daily rulemaking digest" },
  { name: "U.S. Securities and Exchange Commission", url: "https://www.sec.gov", note: "Press releases, rulemakings, enforcement" },
  { name: "Federal Trade Commission", url: "https://www.ftc.gov", note: "Consumer protection, antitrust" },
  { name: "Congress.gov", url: "https://www.congress.gov", note: "Bills, public laws, votes" },
  { name: "Supreme Court of the United States", url: "https://www.supremecourt.gov", note: "Opinions, orders" },
  { name: "State AG offices (CA, NY, TX, FL)", url: null, note: "Initial state coverage" },
];

const INDIA_SOURCES = [
  { name: "PRS Legislative Research", url: "https://prsindia.org", note: "Bill summaries, parliamentary tracking" },
  { name: "India Code", url: "https://www.indiacode.nic.in", note: "Central acts and rules" },
  { name: "Securities and Exchange Board of India", url: "https://www.sebi.gov.in", note: "Capital markets regulation" },
  { name: "Reserve Bank of India", url: "https://www.rbi.org.in", note: "Banking, NBFC, payment-systems policy" },
  { name: "Ministry of Electronics and Information Technology", url: "https://www.meity.gov.in", note: "Data privacy, IT rules" },
  { name: "Supreme Court of India", url: "https://www.sci.gov.in", note: "Constitutional and statutory rulings" },
];

export default function SourcesPage() {
  return (
    <div className="max-w-4xl">
      <p className="text-xs uppercase tracking-widest text-muted mb-4">Sources</p>
      <h1 className="font-serif text-4xl leading-tight mb-6">
        Where the signal comes from.
      </h1>
      <p className="text-muted leading-relaxed mb-12 max-w-prose">
        We monitor primary sources only — regulator sites, legislative trackers,
        and court records. Secondary commentary informs our reading but never
        substitutes for the original document.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <section>
          <h2 className="font-serif text-xl mb-4">United States</h2>
          <ul className="space-y-4">
            {USA_SOURCES.map((s) => (
              <li key={s.name}>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline underline-offset-4"
                  >
                    {s.name}
                  </a>
                ) : (
                  <span className="font-medium">{s.name}</span>
                )}
                <p className="text-sm text-muted mt-0.5">{s.note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl mb-4">India</h2>
          <ul className="space-y-4">
            {INDIA_SOURCES.map((s) => (
              <li key={s.name}>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline underline-offset-4"
                  >
                    {s.name}
                  </a>
                ) : (
                  <span className="font-medium">{s.name}</span>
                )}
                <p className="text-sm text-muted mt-0.5">{s.note}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-sm text-muted mt-16 max-w-prose">
        Missing a source we should track?{" "}
        <a href="/contact" className="underline underline-offset-4">
          Suggest one
        </a>
        .
      </p>
    </div>
  );
}

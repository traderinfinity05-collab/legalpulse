import Link from "next/link";
import { NewsletterForm } from "./newsletter-form";

export function SiteFooter() {
  return (
    <footer className="border-t border-rule mt-24">
      <div className="mx-auto max-w-6xl px-6 py-16 grid grid-cols-1 md:grid-cols-12 gap-10">
        {/* Brand + newsletter */}
        <div className="md:col-span-5">
          <p className="font-serif text-2xl mb-2">LegalPulse</p>
          <p className="text-sm text-muted mb-6 max-w-sm">
            Weekly intelligence on regulatory and legal change in the United
            States and India. Built for operators and counsel.
          </p>
          <p className="text-xs uppercase tracking-widest text-muted mb-3">
            Subscribe
          </p>
          <NewsletterForm variant="footer" />
        </div>

        {/* Nav */}
        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-widest text-muted mb-4">
            Read
          </p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/reports" className="hover:underline underline-offset-4">Reports</Link></li>
            <li><Link href="/" className="hover:underline underline-offset-4">Home</Link></li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <p className="text-xs uppercase tracking-widest text-muted mb-4">
            About
          </p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/about" className="hover:underline underline-offset-4">About</Link></li>
            <li><Link href="/methodology" className="hover:underline underline-offset-4">Methodology</Link></li>
            <li><Link href="/sources" className="hover:underline underline-offset-4">Sources</Link></li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <p className="text-xs uppercase tracking-widest text-muted mb-4">
            Contact
          </p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/contact" className="hover:underline underline-offset-4">Contact us</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-rule">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col md:flex-row justify-between gap-3 text-xs text-muted">
          <p>© {new Date().getFullYear()} LegalPulse. Automated analysis, not legal advice.</p>
          <p>Consult qualified counsel before acting on anything you read here.</p>
        </div>
      </div>
    </footer>
  );
}

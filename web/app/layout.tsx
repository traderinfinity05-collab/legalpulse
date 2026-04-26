import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { SiteFooter } from "./_components/site-footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LegalPulse — Weekly legal intelligence",
    template: "%s · LegalPulse",
  },
  description:
    "Weekly McKinsey-style reports on regulatory and legal change across the United States and India.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body className="min-h-screen flex flex-col bg-paper text-ink">
        <header className="border-b border-rule">
          <div className="mx-auto max-w-6xl px-6 py-5 flex items-baseline justify-between">
            <Link href="/" className="font-serif text-xl tracking-tight">
              LegalPulse
            </Link>
            <nav className="flex gap-7 text-sm">
              <Link href="/reports" className="hover:underline underline-offset-4">
                Reports
              </Link>
              <Link href="/methodology" className="text-muted hover:text-ink transition-colors">
                Methodology
              </Link>
              <Link href="/about" className="text-muted hover:text-ink transition-colors">
                About
              </Link>
              <Link href="/contact" className="text-muted hover:text-ink transition-colors">
                Contact
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-12">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

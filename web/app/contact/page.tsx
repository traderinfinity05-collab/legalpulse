import type { Metadata } from "next";
import { ContactForm } from "../_components/contact-form";

export const metadata: Metadata = {
  title: "Contact — LegalPulse",
  description:
    "Get in touch with the LegalPulse team. Press, partnerships, source suggestions, and corrections welcome.",
};

export default function ContactPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-12 max-w-5xl">
      <div className="md:col-span-5">
        <p className="text-xs uppercase tracking-widest text-muted mb-4">
          Contact
        </p>
        <h1 className="font-serif text-4xl leading-tight mb-6">
          Tell us what you&apos;re working on.
        </h1>
        <p className="text-muted leading-relaxed mb-8">
          Press, partnerships, source suggestions, and corrections — all
          welcome. We read every message and reply within a few business days.
        </p>
        <p className="text-sm text-muted">
          For time-sensitive corrections to a published report, please include
          the report URL and the specific claim you&apos;re flagging.
        </p>
      </div>

      <div className="md:col-span-7">
        <ContactForm />
      </div>
    </div>
  );
}

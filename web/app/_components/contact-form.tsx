"use client";

import { useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");  // hidden anti-bot field
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "submitting") return;
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, message, honeypot }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (Array.isArray(body.issues) && body.issues[0]) ||
          "Something went wrong. Try again.";
        setStatus({ kind: "error", message: msg });
        return;
      }
      setStatus({ kind: "ok" });
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus({ kind: "error", message: "Network error. Try again." });
    }
  }

  if (status.kind === "ok") {
    return (
      <div className="border-l-2 border-usa pl-6 py-2">
        <p className="font-serif text-lg mb-1">Thanks — message received.</p>
        <p className="text-muted text-sm">
          We read every message. Replies typically come within a few business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-xl">
      {/* Honeypot — hidden from humans, irresistible to bots. */}
      <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
        <label>
          Leave this field empty
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      <div>
        <label htmlFor="name" className="block text-xs uppercase tracking-widest text-muted mb-2">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-rule focus:border-ink bg-transparent px-3 py-2 text-sm focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-xs uppercase tracking-widest text-muted mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-rule focus:border-ink bg-transparent px-3 py-2 text-sm focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-xs uppercase tracking-widest text-muted mb-2">
          Message
        </label>
        <textarea
          id="message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full border border-rule focus:border-ink bg-transparent px-3 py-2 text-sm focus:outline-none transition-colors resize-y"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status.kind === "submitting"}
          className="text-sm border border-ink px-6 py-2 hover:bg-ink hover:text-paper disabled:opacity-50 transition-colors"
        >
          {status.kind === "submitting" ? "Sending…" : "Send message"}
        </button>
        {status.kind === "error" && (
          <p className="text-xs text-red-700">{status.message}</p>
        )}
      </div>
    </form>
  );
}

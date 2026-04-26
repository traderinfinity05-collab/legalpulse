"use client";

import { useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function NewsletterForm({ variant = "footer" }: { variant?: "footer" | "inline" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "submitting") return;
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
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
      setEmail("");
    } catch {
      setStatus({ kind: "error", message: "Network error. Try again." });
    }
  }

  if (status.kind === "ok") {
    return (
      <p className="text-sm text-muted">
        You&apos;re on the list. Reports arrive Mondays.
      </p>
    );
  }

  const compact = variant === "footer";

  return (
    <form onSubmit={onSubmit} className={compact ? "max-w-sm" : "max-w-md"}>
      <div className="flex border border-rule focus-within:border-ink transition-colors">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-transparent px-3 py-2 text-sm placeholder:text-muted focus:outline-none"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={status.kind === "submitting"}
          className="px-4 py-2 text-sm bg-ink text-paper hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {status.kind === "submitting" ? "…" : "Subscribe"}
        </button>
      </div>
      {status.kind === "error" && (
        <p className="mt-2 text-xs text-red-700">{status.message}</p>
      )}
      <p className="mt-2 text-xs text-muted">
        One email a week. Unsubscribe anytime.
      </p>
    </form>
  );
}

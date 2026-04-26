import { NextRequest, NextResponse } from "next/server";
import { NewsletterSignupInput } from "@/lib/schemas";
import { subscribeNewsletter } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = NewsletterSignupInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const result = await subscribeNewsletter(parsed.data);
  // We return 200 for both new and already-subscribed: from the user's
  // perspective they're subscribed either way, and silently no-op'ing on
  // dupes prevents email-existence enumeration.
  return NextResponse.json({ ok: true, result });
}

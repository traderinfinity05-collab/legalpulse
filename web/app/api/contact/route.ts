import { NextRequest, NextResponse } from "next/server";
import { ContactMessageInput } from "@/lib/schemas";
import { createContactMessage } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ContactMessageInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  // Honeypot: bots fill every input including the hidden one. Return 200
  // (don't tell them they were caught) but skip the DB write.
  if (parsed.data.honeypot && parsed.data.honeypot.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const userAgent = req.headers.get("user-agent");
  // x-forwarded-for may include multiple IPs — first is the originating client.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { id } = await createContactMessage(parsed.data, { userAgent, ip });
  return NextResponse.json({ ok: true, id });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listReports } from "@/lib/repository";

export const dynamic = "force-dynamic";

const Query = z.object({
  country: z.enum(["USA", "INDIA"]).optional(),
  state: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const reports = await listReports(parsed.data);
  return NextResponse.json({ reports });
}

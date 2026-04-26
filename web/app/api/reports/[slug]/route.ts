import { NextResponse } from "next/server";
import { getReportBySlug } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const report = await getReportBySlug(slug);
  if (!report) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ report });
}

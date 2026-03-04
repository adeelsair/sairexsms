import { NextResponse } from "next/server";

export async function GET() {
  throw new Error("Sentry test error — DELETE THIS ROUTE after confirming");
  return NextResponse.json({ ok: true });
}

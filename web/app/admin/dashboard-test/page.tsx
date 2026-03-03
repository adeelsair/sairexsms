import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";

export default async function DashboardTestPage() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) {
    redirect("/login");
  }
  return <div>OK</div>;
}

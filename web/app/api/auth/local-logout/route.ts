import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  readSessionTokenFromCookieHeader,
  resolveSessionCookieName,
} from "@/lib/auth/session-cookie";

export async function POST(request: Request) {
  const token = readSessionTokenFromCookieHeader(request.headers.get("cookie"));
  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: token } });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(resolveSessionCookieName());
  response.cookies.delete("authjs.session-token");
  response.cookies.delete("__Secure-authjs.session-token");
  response.cookies.delete("next-auth.session-token");
  response.cookies.delete("__Secure-next-auth.session-token");
  response.cookies.delete("sx_impersonation");
  return response;
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  attachSessionCookie,
  issueSessionForUserId,
} from "@/lib/auth/session-issuer";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/**
 * POST /api/login — Email/password login (session cookie).
 * Use this instead of /api/auth/local-login to avoid NextAuth catch-all conflicts.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials payload", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        isActive: true,
        emailVerifiedAt: true,
        platformRole: true,
        password: true,
      },
    });

    if (!user || !user.isActive || !user.password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.emailVerifiedAt && !user.platformRole) {
      return NextResponse.json({ error: "Email verification required" }, { status: 403 });
    }

    const passwordValid = await bcrypt.compare(parsed.data.password, user.password);
    if (!passwordValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const issued = await issueSessionForUserId(user.id);
    if (!issued) {
      return NextResponse.json({ error: "Account not active" }, { status: 401 });
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: String(issued.context.userId),
        email: issued.context.email,
        name: issued.context.name,
      },
    });
    attachSessionCookie(response, issued.sessionToken, issued.expires);
    return response;
  } catch (error) {
    console.error("[Login] Failed:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

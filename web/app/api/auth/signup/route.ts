import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueue, EMAIL_QUEUE } from "@/lib/queue";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/auth/signup
 *
 * Two modes:
 *   1. Invite flow  → inviteToken present → creates verified, active User + Membership
 *   2. Register flow → no inviteToken → creates unverified User + sends verification email
 *
 * Organization creation happens later in the onboarding wizard (after email verification).
 */
export async function POST(request: Request) {
  const blocked = applyRateLimit(request, "auth:signup", RATE_LIMITS.LOGIN_ATTEMPT);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { name, email, password, inviteToken } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // ─── MODE 1: Invited user (token present) ───
    if (inviteToken) {
      const invitation = await prisma.invitation.findUnique({
        where: { token: inviteToken },
        include: { organization: true },
      });

      if (!invitation) {
        return NextResponse.json(
          { error: "Invalid invite link" },
          { status: 400 },
        );
      }

      if (invitation.acceptedAt) {
        return NextResponse.json(
          { error: "This invite has already been used" },
          { status: 400 },
        );
      }

      if (new Date() > invitation.expiresAt) {
        return NextResponse.json(
          { error: "This invite has expired. Please ask your admin for a new one." },
          { status: 400 },
        );
      }

      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json(
          { error: "This invite was sent to a different email address" },
          { status: 403 },
        );
      }

      // Invite = proof of email ownership → auto-verify + activate
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email: invitation.email.toLowerCase(),
            password: hashedPassword,
            isActive: true,
            emailVerifiedAt: new Date(),
          },
        });

        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
            status: "ACTIVE",
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });

        return user;
      });

      return NextResponse.json(
        {
          message: "Account created successfully",
          user: { id: result.id, email: result.email },
          organizationName: invitation.organization.organizationName,
          verified: true,
        },
        { status: 201 },
      );
    }

    // ─── MODE 2: Self-registration (no invite) ───
    // Create user as inactive + unverified, send verification email.
    // Org creation deferred to onboarding wizard.

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        isActive: false,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verifyToken}`;

    await enqueue({
      type: "EMAIL",
      queue: EMAIL_QUEUE,
      payload: {
        to: email.toLowerCase(),
        subject: "Verify your email — SAIREX SMS",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1e40af;">SAIREX SMS</h2>
            <p>Thank you for registering. Please verify your email address to continue.</p>
            <p style="margin: 24px 0;">
              <a href="${verifyUrl}"
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Verify Email
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">
              This link expires in 24 hours. If you didn't create this account, ignore this email.
            </p>
          </div>
        `,
      },
    });

    return NextResponse.json(
      {
        message: "Account created. Please check your email to verify your address.",
        verified: false,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}

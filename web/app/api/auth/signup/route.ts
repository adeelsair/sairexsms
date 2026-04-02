import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  PASSWORD_POLICY_ERROR,
  isPasswordPolicyCompliant,
} from "@/lib/auth/password-policy";
import {
  newEmailVerificationToken,
  sendVerificationEmail,
} from "@/lib/auth/verification-email";

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

    if (!isPasswordPolicyCompliant(password)) {
      return NextResponse.json(
        { error: PASSWORD_POLICY_ERROR },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (!existingUser.emailVerifiedAt && !existingUser.platformRole) {
        const activeMemberships = await prisma.membership.count({
          where: { userId: existingUser.id, status: "ACTIVE" },
        });
        // Invited users are created with an active membership but no verified email.
        // Do not overwrite password / deactivate via public signup — they must use the invite link.
        if (activeMemberships > 0) {
          return NextResponse.json(
            {
              error:
                "This email is already linked to an organization invite. Open your invitation email and use the signup link, or ask your admin to resend the invite.",
            },
            { status: 409 },
          );
        }

        const { token: verifyToken, expiresAt: verifyExpires } = newEmailVerificationToken();

        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            password: await bcrypt.hash(password, 12),
            emailVerifyToken: verifyToken,
            emailVerifyExpires: verifyExpires,
            isActive: false,
          },
        });

        await sendVerificationEmail(normalizedEmail, verifyToken, existingUser.id);

        return NextResponse.json(
          {
            message: "Email not verified. A new verification email has been sent.",
            verified: false,
            resent: true,
          },
          { status: 200 },
        );
      }

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

    const { token: verifyToken, expiresAt: verifyExpires } = newEmailVerificationToken();

    const created = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        isActive: false,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
      },
      select: { id: true },
    });
    await sendVerificationEmail(normalizedEmail, verifyToken, created.id);

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

"use client";

import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle2, Mail } from "lucide-react";

import { api } from "@/lib/api-client";
import { signupSchema, type SignupInput } from "@/lib/validations/signup";

import { SxButton, SxStatusBadge } from "@/components/sx";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

interface InviteInfo {
  email: string;
  role: string;
  orgName: string;
}

interface SignupResponse {
  message: string;
  user?: { id: number; email: string };
  organizationName?: string;
  verified: boolean;
}

/* ══════════════════════════════════════════════════════════════
   Signup Form
   ══════════════════════════════════════════════════════════════ */

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") || "";

  const isInvited = !!inviteToken;

  /* ── State ──────────────────────────────────────────────── */

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  /* ── Invite validation ──────────────────────────────────── */

  useEffect(() => {
    if (!inviteToken) return;

    api.get<InviteInfo>(`/api/invites/validate?token=${inviteToken}`).then(
      (result) => {
        if (result.ok) {
          setInviteInfo(result.data);
        } else {
          setInviteError(result.error);
        }
      },
    );
  }, [inviteToken]);

  /* ── Form: Zod + React Hook Form ────────────────────────── */

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      inviteToken: inviteToken || undefined,
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  useEffect(() => {
    if (inviteInfo?.email) {
      form.setValue("email", inviteInfo.email);
    }
  }, [inviteInfo, form]);

  /* ── Submit ─────────────────────────────────────────────── */

  const onSubmit = async (data: SignupInput) => {
    const result = await api.post<SignupResponse>("/api/auth/signup", {
      name: data.name,
      email: data.email,
      password: data.password,
      inviteToken: data.inviteToken,
    });

    if (result.ok) {
      if (result.data.verified) {
        // Invite flow: auto-verified → sign in immediately
        toast.success("Account created successfully");

        const signInResult = await api.post<{ ok: boolean; user: { id: string } }>(
          "/api/auth/local-login",
          {
            email: data.email,
            password: data.password,
          },
        );

        if (!signInResult.ok) {
          router.push("/login");
        } else {
          router.push("/admin/dashboard");
          router.refresh();
        }
      } else {
        // Self-register: show verification email sent screen
        setEmailSent(true);
        setRegisteredEmail(data.email);
      }
    } else if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        form.setError(field as keyof SignupInput, {
          message: messages[0],
        });
      }
      toast.error("Please fix the validation errors");
    } else {
      toast.error(result.error);
    }
  };

  /* ── Invite error state ─────────────────────────────────── */

  if (isInvited && inviteError) {
    return (
      <div className="rounded-lg border border-border bg-card/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-warning" />
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Invalid Invite
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">{inviteError}</p>
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          Go to login
        </Link>
      </div>
    );
  }

  /* ── Invite loading state ───────────────────────────────── */

  if (isInvited && !inviteInfo && !inviteError) {
    return (
      <div className="rounded-lg border border-border bg-card/80 p-8 text-center text-muted-foreground shadow-2xl backdrop-blur-xl">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Validating invite...
      </div>
    );
  }

  /* ── Email sent success state ────────────────────────────── */

  if (emailSent) {
    return (
      <div className="rounded-lg border border-border bg-card/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        <Mail className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Check your email
        </h2>
        <p className="mb-2 text-sm text-muted-foreground">
          We sent a verification link to
        </p>
        <p className="mb-6 font-medium text-foreground">{registeredEmail}</p>
        <p className="mb-6 text-xs text-muted-foreground">
          Click the link in the email to verify your address and continue setting up your organization.
          The link expires in 24 hours.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          Go to login
        </Link>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="rounded-lg border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        {isInvited ? "Join your organization" : "Create your Account"}
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {isInvited ? (
          <>
            You&apos;ve been invited to join{" "}
            <strong className="text-foreground">{inviteInfo?.orgName}</strong> as{" "}
            <SxStatusBadge variant="info" className="align-middle">
              {inviteInfo?.role?.replace("_", " ")}
            </SxStatusBadge>
          </>
        ) : (
          "Register to get started with SAIREX SMS"
        )}
      </p>

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="Your full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    readOnly={isInvited}
                    disabled={isInvited}
                    {...field}
                  />
                </FormControl>
                {isInvited && (
                  <p className="text-xs text-muted-foreground">
                    Set by your admin — cannot be changed
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Minimum 8 characters"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Confirm Password */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Repeat your password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit */}
          <SxButton
            type="submit"
            sxVariant="primary"
            loading={isSubmitting}
            className="w-full py-3"
          >
            {isInvited ? "Join organization" : "Create account"}
          </SxButton>
        </form>
      </Form>

      {!isInvited && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          You&apos;ll receive a verification email to confirm your address
        </p>
      )}

      <div className="mt-5 text-center">
        <span className="text-sm text-muted-foreground">
          Already have an account?{" "}
        </span>
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Page Export
   ══════════════════════════════════════════════════════════════ */

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-border bg-card/80 p-8 text-center text-muted-foreground shadow-2xl backdrop-blur-xl">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Loading...
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";

import { api } from "@/lib/api-client";
import { signupSchema, type SignupInput } from "@/lib/validations/signup";
import { PASSWORD_RULE_TEXT } from "@/lib/auth/password-policy";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const authInputClass = "bg-background text-foreground placeholder:text-foreground/70";

  const isInvited = !!inviteToken;

  /* ── State ──────────────────────────────────────────────── */

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
          "/api/login",
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
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
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
      <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground shadow-sm sm:p-8">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Validating invite...
      </div>
    );
  }

  /* ── Email sent success state ────────────────────────────── */

  if (emailSent) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
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
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        {isInvited ? "Join your organization" : "Create your account"}
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
          "Create your account to start managing your school with SAIREX SMS."
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
                  <Input placeholder="Your full name" className={authInputClass} {...field} />
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
                    className={authInputClass}
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
                <div className="flex items-center gap-1.5">
                  <FormLabel className="mb-0">Password</FormLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Show password setup rules"
                          className="inline-flex items-center rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs p-3 text-xs">
                        <p className="mb-1 font-semibold">Password rules:</p>
                        <ul className="list-disc space-y-0.5 pl-4">
                          <li>{PASSWORD_RULE_TEXT.minLength}</li>
                          <li>{PASSWORD_RULE_TEXT.uppercase}</li>
                          <li>{PASSWORD_RULE_TEXT.lowercase}</li>
                          <li>{PASSWORD_RULE_TEXT.number}</li>
                          <li>{PASSWORD_RULE_TEXT.symbol}</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      className={`${authInputClass} pr-10`}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
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
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repeat your password"
                      className={`${authInputClass} pr-10`}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
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
          We&apos;ll send a verification email to confirm your address.
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
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground shadow-sm sm:p-8">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Loading...
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}

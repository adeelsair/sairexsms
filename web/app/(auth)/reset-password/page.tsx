"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, Eye, EyeOff, Info } from "lucide-react";
import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { SxButton } from "@/components/sx";
import {
  isPasswordPolicyCompliant,
  PASSWORD_POLICY_ERROR,
  PASSWORD_RULE_TEXT,
} from "@/lib/auth/password-policy";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const authInputClass = "bg-background text-foreground placeholder:text-foreground/70";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isPasswordPolicyCompliant(newPassword)) {
      setError(PASSWORD_POLICY_ERROR);
      return;
    }

    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }

    setLoading(true);

    const result = await api.post<{ message: string }>("/api/auth/reset-password", {
      token,
      newPassword,
    });

    if (!result.ok) {
      setError(result.error || "Failed to reset password.");
    } else {
      setSuccess(true);
    }

    setLoading(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      {success ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-success" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Password reset!
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <SxButton asChild sxVariant="primary">
            <Link href="/login">Go to sign in</Link>
          </SxButton>
        </div>
      ) : (
        <>
          <h2 className="mb-1 text-xl font-semibold text-foreground">
            Set a new password
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="newPassword"
                className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                <span>New Password</span>
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
              </label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  autoFocus
                  className={`${authInputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  required
                  minLength={8}
                  className={`${authInputClass} pr-10`}
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
            </div>

            <SxButton
              type="submit"
              disabled={loading}
              sxVariant="primary"
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting...
                </span>
              ) : (
                "Reset password"
              )}
            </SxButton>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              Back to sign in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground shadow-sm sm:p-8">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Loading...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

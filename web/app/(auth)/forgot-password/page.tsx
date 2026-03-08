"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { SxButton } from "@/components/sx";

export default function ForgotPasswordPage() {
  const authInputClass = "bg-background text-foreground placeholder:text-foreground/70";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await api.post<{ message: string }>("/api/auth/forgot-password", {
      email,
    });

    if (!result.ok) {
      setError(result.error || "Something went wrong.");
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      {sent ? (
        <div className="text-center">
          <Mail className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Check your email
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            If an account with{" "}
            <strong className="text-foreground">{email}</strong> exists,
            we&apos;ve sent a password reset link. It expires in 1 hour.
          </p>
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <>
          <h2 className="mb-1 text-xl font-semibold text-foreground">
            Forgot your password?
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter your account email and we&apos;ll send a reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className={authInputClass}
              />
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
                  Sending...
                </span>
              ) : (
                "Send reset link"
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

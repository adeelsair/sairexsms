"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
      {sent ? (
        <div className="text-center">
          <Mail className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h2 className="mb-2 text-xl font-semibold text-white">
            Check your email
          </h2>
          <p className="mb-6 text-sm text-slate-400">
            If an account with{" "}
            <strong className="text-slate-300">{email}</strong> exists,
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
          <h2 className="mb-1 text-xl font-semibold text-white">
            Forgot your password?
          </h2>
          <p className="mb-6 text-sm text-slate-400">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </span>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              Back to login
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

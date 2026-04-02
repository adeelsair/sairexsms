"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { SxButton } from "@/components/sx";

export default function LoginPage() {
  const router = useRouter();
  const authInputClass = "bg-background text-foreground placeholder:text-foreground/70";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [useInviteLink, setUseInviteLink] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setUseInviteLink(false);
    setLoading(true);

    const result = await api.post<{ ok: boolean; user: { id: string } }>(
      "/api/login",
      {
      email,
      password,
      },
    );

    if (!result.ok) {
      if (result.status === 403 && result.needsVerification) {
        setNeedsVerification(true);
        setUseInviteLink(!!result.useInviteLink);
      }
      setError(result.error || "Invalid email or password. Please try again.");
      setLoading(false);
    } else {
      router.push("/admin/dashboard");
      router.refresh();
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim() || !password) {
      toast.error("Enter your email and password above, then tap resend.");
      return;
    }
    setResending(true);
    const result = await api.post<{ message: string; sent?: boolean }>(
      "/api/auth/resend-verification",
      { email: email.trim().toLowerCase(), password },
    );
    setResending(false);
    if (result.ok) {
      toast.success(result.data.message);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="mb-1 text-xl font-semibold text-foreground">Welcome back</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in to continue to your school admin dashboard.
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
              placeholder="you@example.com"
              required
              autoFocus
              className={authInputClass}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className={`${authInputClass} pr-10`}
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
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </SxButton>
        </form>

        {needsVerification && (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              {useInviteLink ? "Finish invite signup" : "Verify your email"}
            </div>
            {useInviteLink ? (
              <p className="text-muted-foreground">
                This email is tied to an organization invitation. Open the invite email and use the
                signup link there. Ask your admin to resend the invite if you can&apos;t find it.
              </p>
            ) : (
              <>
                <p className="mb-3 text-muted-foreground">
                  We found your account, but this address isn&apos;t verified yet. Use the same email
                  and password you entered above, then send another verification email.
                </p>
                <SxButton
                  type="button"
                  sxVariant="secondary"
                  className="w-full"
                  loading={resending}
                  onClick={handleResendVerification}
                >
                  Resend verification email
                </SxButton>
              </>
            )}
          </div>
        )}

        <div className="mt-5 space-y-2 text-center">
          <div>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              Forgot your password?
            </Link>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
            </span>
            <Link
              href="/signup"
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

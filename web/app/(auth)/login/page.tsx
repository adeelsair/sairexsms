"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await api.post<{ ok: boolean; user: { id: string } }>(
      "/api/auth/local-login",
      {
      email,
      password,
      },
    );

    if (!result.ok) {
      setError(result.error || "Invalid email or password. Please try again.");
      setLoading(false);
    } else {
      router.push("/admin/dashboard");
      router.refresh();
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

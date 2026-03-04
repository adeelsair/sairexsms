"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertTriangle, CheckCircle2, Mail } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-warning" />
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Verification Failed
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">{error}</p>
        <Link
          href="/signup"
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          Register again
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card/80 p-8 text-center shadow-2xl backdrop-blur-xl">
      <Mail className="mx-auto mb-4 h-10 w-10 text-primary" />
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        Verify your email
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        We sent a verification link to your email address.
        Please check your inbox (and spam folder) and click the link to continue.
      </p>
      <p className="mb-6 text-xs text-muted-foreground">
        The link expires in 24 hours.
      </p>
      <div className="space-y-2">
        <Link
          href="/login"
          className="block text-sm font-medium text-primary hover:text-primary/80"
        >
          Already verified? Sign in
        </Link>
        <Link
          href="/signup"
          className="block text-sm text-muted-foreground hover:text-foreground"
        >
          Didn&apos;t receive it? Register again
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-border bg-card/80 p-8 text-center text-muted-foreground shadow-2xl backdrop-blur-xl">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Loading...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

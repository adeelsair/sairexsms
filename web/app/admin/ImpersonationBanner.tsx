"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { SxButton } from "@/components/sx";

interface ImpersonationBannerProps {
  tenantName: string;
}

interface ExitImpersonationResponse {
  ok: boolean;
}

export function ImpersonationBanner({ tenantName }: ImpersonationBannerProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [exiting, setExiting] = useState(false);
  const impersonationExpiresAt = Number(
    (session?.user as { impersonationExpiresAt?: number | null } | undefined)
      ?.impersonationExpiresAt ?? 0,
  );

  const onExit = async () => {
    setExiting(true);
    const result = await api.post<ExitImpersonationResponse>("/api/superadmin/exit-impersonation");
    if (!result.ok) {
      toast.error(result.error);
      setExiting(false);
      return;
    }

    toast.success("Exited impersonation mode");
    router.replace("/admin/dashboard");
    router.refresh();
    setExiting(false);
  };

  useEffect(() => {
    const expiresAt = impersonationExpiresAt;
    if (!expiresAt || exiting) return;

    const waitMs = Math.max(expiresAt - Date.now(), 0);
    const timer = window.setTimeout(() => {
      void onExit();
    }, waitMs);

    return () => window.clearTimeout(timer);
  }, [exiting, impersonationExpiresAt]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] border-b shadow-lg"
      style={{ backgroundColor: "#B91C1C", borderColor: "#7F1D1D", color: "#FFFFFF" }}
    >
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-2 md:px-6">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle size={16} />
          IMPERSONATION MODE — Acting as {tenantName}
        </p>
        <SxButton
          sxVariant="secondary"
          className="bg-[rgba(255,255,255,0.15)] text-white hover:bg-[rgba(255,255,255,0.25)]"
          loading={exiting}
          onClick={onExit}
        >
          Exit Impersonation
        </SxButton>
      </div>
    </div>
  );
}

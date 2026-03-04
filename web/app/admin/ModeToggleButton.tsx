"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { SxButton } from "@/components/sx";

interface OrganizationModeUpdateEnvelope {
  ok: boolean;
  organizationId: string;
  mode: "SIMPLE" | "PRO";
}

export function ModeToggleButton(props: { currentMode: "SIMPLE" | "PRO" }) {
  const router = useRouter();
  const [mode, setMode] = useState<"SIMPLE" | "PRO">(props.currentMode);
  const [loading, setLoading] = useState(false);

  const nextMode = mode === "SIMPLE" ? "PRO" : "SIMPLE";

  async function onToggle() {
    setLoading(true);
    const result = await api.patch<OrganizationModeUpdateEnvelope>("/api/organizations/mode", {
      mode: nextMode,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setMode(result.data.mode);
    toast.success(result.data.mode === "PRO" ? "Pro mode enabled" : "Simple mode enabled");
    router.refresh();
    if (result.data.mode === "SIMPLE") {
      router.push("/mobile/dashboard");
    }
  }

  return (
    <SxButton sxVariant="outline" className="w-full justify-center" loading={loading} onClick={onToggle}>
      {mode === "PRO" ? "Use Simple Mode" : "Use Pro Mode"}
    </SxButton>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { PlanUsagePayload } from "./plan-usage.service";

interface PlanUsageEnvelope {
  ok: boolean;
  data: PlanUsagePayload;
  error?: string;
}

type PlanLimitKey = "students" | "campuses" | "staff";

interface UsePlanUsageOptions {
  enabled?: boolean;
  initialUsage?: PlanUsagePayload | null;
}

export function usePlanUsage(options?: UsePlanUsageOptions) {
  const enabled = options?.enabled ?? true;
  const [usage, setUsage] = useState<PlanUsagePayload | null>(options?.initialUsage ?? null);
  const [loading, setLoading] = useState(enabled && !options?.initialUsage);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const result = await api.get<PlanUsageEnvelope>("/api/billing/plan-usage");
    if (!result.ok) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to load plan usage");
      setLoading(false);
      return;
    }
    setUsage(result.data.data);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      refresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [enabled, refresh]);

  return { usage, loading, refresh };
}

export function usePlanLimit(key: PlanLimitKey) {
  const { usage, loading, refresh } = usePlanUsage();

  return useMemo(() => {
    const used = usage?.usage[key] ?? 0;
    const limit = usage?.limits[key] ?? 0;
    const reached = limit > 0 ? used >= limit : false;
    const nearLimit = limit > 0 ? used / limit >= 0.7 : false;

    return {
      plan: usage?.plan ?? "STARTER",
      used,
      limit,
      reached,
      nearLimit,
      loading,
      refresh,
    };
  }, [usage, key, loading, refresh]);
}


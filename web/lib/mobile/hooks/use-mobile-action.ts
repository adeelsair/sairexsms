"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { queueOfflineAction } from "@/lib/mobile/mobile-offline-queue";
import { optimisticUpdate } from "@/lib/mobile/optimistic/mobile-optimistic-updater";

type MobileActionRequest<TPayload> = {
  type: string;
  payload: TPayload;
};

type MobileActionResponse = {
  queued?: boolean;
  message?: string;
  posted?: boolean;
  receiptNo?: string;
  wasDefaulterCleared?: boolean;
  result?: {
    paymentRecordId?: string;
    challanId?: number;
    challanStatus?: string;
    newPaidAmount?: number;
    ledgerEntryId?: string;
    classId?: string;
    sectionId?: string;
    presentCount?: number;
    absentCount?: number;
    studentId?: number;
    grNumber?: string;
    draftId?: string;
    generated?: number;
    skipped?: number;
    challanIds?: number[];
    totalAmount?: number;
    className?: string;
    studentName?: string;
  };
};

export function useMobileAction() {
  const queryClient = useQueryClient();

  async function execute<TPayload>(type: string, payload: TPayload) {
    const isOffline = !navigator.onLine;
    const previousDashboardSnapshot = queryClient.getQueryData([
      "mobile-dashboard",
    ]);

    optimisticUpdate(type, payload, queryClient);

    if (isOffline) {
      await queueOfflineAction({ type, payload });
      toast.success("Action queued offline. It will sync automatically.");
      return { ok: true as const, queued: true };
    }

    const result = await api.post<MobileActionResponse>(
      "/api/mobile/action",
      {
        type,
        payload,
      } satisfies MobileActionRequest<TPayload>,
    );

    if (result.ok) {
      queryClient.invalidateQueries({
        queryKey: ["mobile-dashboard"],
      });
      return { ok: true as const, queued: false, data: result.data };
    }

    queryClient.setQueryData(["mobile-dashboard"], previousDashboardSnapshot);
    toast.error(result.error);
    return { ok: false as const, error: result.error };
  }

  return { execute };
}

"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useMobileActionRealtime(orgId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const suffix = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
    const source = new EventSource(`/api/mobile/action-events${suffix}`);

    const refreshHandler = () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-today-actions"] });
    };

    source.addEventListener("ACTION_REFRESH", refreshHandler);

    return () => {
      source.removeEventListener("ACTION_REFRESH", refreshHandler);
      source.close();
    };
  }, [orgId, queryClient]);
}

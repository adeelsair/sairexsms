"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "sairex-public-onboarding";

export type PublicOnboardingDraft = {
  token?: string;
  schoolInfo?: {
    schoolName: string;
    city: string;
    contactNumber: string;
    approxStudents: "1-100" | "101-300" | "301-600" | "601-1000" | "1000+";
  };
  academicSetup?: {
    classes: number[];
    sectionsPerClass: number;
  };
  feeSetup?: {
    averageMonthlyFee: number;
  };
  adminSetup?: {
    adminName: string;
    mobile: string;
    password: string;
  };
};

export function usePublicOnboardingDraft() {
  const [draft, setDraft] = useState<PublicOnboardingDraft>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDraft(JSON.parse(stored) as PublicOnboardingDraft);
      }
    } catch {
      setDraft({});
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, ready]);

  function patchDraft(patch: Partial<PublicOnboardingDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function clearDraft() {
    setDraft({});
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    draft,
    ready,
    patchDraft,
    clearDraft,
  };
}

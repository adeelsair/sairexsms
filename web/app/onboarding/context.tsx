"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  OnboardingIdentityInput,
  OnboardingLegalInput,
  OnboardingContactAddressInput,
  OnboardingBrandingInput,
} from "@/lib/validations/onboarding";

const STORAGE_KEY = "sairex-onboarding-draft";
const VERIFIED_KEY = "sairex-onboarding-verified";

// ─── Types ──────────────────────────────────────────────────────────────────

export type StepKey = "identity" | "legal" | "contactAddress" | "branding";

export type VerifiableField = "organizationEmail" | "organizationMobile" | "organizationWhatsApp";

export interface VerifiedEntry {
  value: string;
  verifiedAt: string;
  channel: string;
}

export interface VerifiedFields {
  organizationEmail: VerifiedEntry | null;
  organizationMobile: VerifiedEntry | null;
  organizationWhatsApp: VerifiedEntry | null;
}

export interface OnboardingDraft {
  identity: OnboardingIdentityInput | null;
  legal: OnboardingLegalInput | null;
  contactAddress: OnboardingContactAddressInput | null;
  branding: OnboardingBrandingInput | null;
  validatedSteps: StepKey[];
}

export interface CompletedOrg {
  id: string;
  slug: string;
  organizationName: string;
  displayName: string;
  organizationCategory: string;
  organizationStructure: string;
  registrationNumber: string | null;
  taxNumber: string | null;
  establishedDate: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  country: string | null;
  provinceState: string | null;
  district: string | null;
  tehsil: string | null;
  city: string | null;
  postalCode: string | null;
  organizationEmail: string | null;
  organizationPhone: string | null;
  organizationMobile: string | null;
  organizationWhatsApp: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  createdAt: string;
  membership?: {
    id: number;
    role: string;
    organizationId: string;
    organizationStructure?: string | null;
    campusId?: number | null;
  };
}

interface OnboardingContextValue {
  draft: OnboardingDraft;
  completedOrg: CompletedOrg | null;
  verifiedFields: VerifiedFields;
  userEmail: string | undefined;
  ready: boolean;
  saveStep: <K extends StepKey>(step: K, value: OnboardingDraft[K]) => void;
  markValidated: (step: StepKey) => void;
  isStepValidated: (step: StepKey) => boolean;
  setCompletedOrg: (org: CompletedOrg) => void;
  markFieldVerified: (field: VerifiableField, value: string, channel: string, verifiedAt?: string) => void;
  isFieldVerified: (field: VerifiableField, value: string) => boolean;
  clearDraft: () => void;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const EMPTY_DRAFT: OnboardingDraft = {
  identity: null,
  legal: null,
  contactAddress: null,
  branding: null,
  validatedSteps: [],
};

const EMPTY_VERIFIED: VerifiedFields = {
  organizationEmail: null,
  organizationMobile: null,
  organizationWhatsApp: null,
};

// ─── Context ────────────────────────────────────────────────────────────────

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children, userEmail }: { children: ReactNode; userEmail?: string }) {
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [completedOrg, setCompletedOrg] = useState<CompletedOrg | null>(null);
  const [verifiedFields, setVerifiedFields] = useState<VerifiedFields>(EMPTY_VERIFIED);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OnboardingDraft;
        setDraft({
          ...EMPTY_DRAFT,
          ...parsed,
          validatedSteps: parsed.validatedSteps ?? [],
        });
      }
    } catch {
      /* corrupted storage — start fresh */
    }
    try {
      const storedV = localStorage.getItem(VERIFIED_KEY);
      if (storedV) {
        setVerifiedFields({ ...EMPTY_VERIFIED, ...JSON.parse(storedV) });
      }
    } catch {
      /* corrupted — start fresh */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    }
  }, [draft, ready]);

  useEffect(() => {
    if (ready) {
      localStorage.setItem(VERIFIED_KEY, JSON.stringify(verifiedFields));
    }
  }, [verifiedFields, ready]);

  const saveStep = useCallback(
    <K extends StepKey>(step: K, value: OnboardingDraft[K]) => {
      setDraft((prev) => ({ ...prev, [step]: value }));
    },
    [],
  );

  const markValidated = useCallback((step: StepKey) => {
    setDraft((prev) => ({
      ...prev,
      validatedSteps: prev.validatedSteps.includes(step)
        ? prev.validatedSteps
        : [...prev.validatedSteps, step],
    }));
  }, []);

  const isStepValidated = useCallback(
    (step: StepKey) => draft.validatedSteps.includes(step),
    [draft.validatedSteps],
  );

  const markFieldVerified = useCallback(
    (field: VerifiableField, value: string, channel: string, verifiedAt?: string) => {
      setVerifiedFields((prev) => ({
        ...prev,
        [field]: { value, verifiedAt: verifiedAt ?? new Date().toISOString(), channel },
      }));
    },
    [],
  );

  const isFieldVerified = useCallback(
    (field: VerifiableField, value: string) => {
      const entry = verifiedFields[field];
      return !!value && !!entry && entry.value === value;
    },
    [verifiedFields],
  );

  const clearDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setVerifiedFields(EMPTY_VERIFIED);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VERIFIED_KEY);
  }, []);

  if (!ready) return null;

  return (
    <OnboardingContext.Provider
      value={{
        draft,
        completedOrg,
        verifiedFields,
        userEmail,
        ready,
        saveStep,
        markValidated,
        isStepValidated,
        setCompletedOrg,
        markFieldVerified,
        isFieldVerified,
        clearDraft,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

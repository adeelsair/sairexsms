"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SxButton } from "@/components/sx";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { usePublicOnboardingDraft } from "@/lib/hooks/usePublicOnboardingDraft";

type AdminCreateResponse = {
  ok: boolean;
  token: string;
};

export default function AdminCreatePage() {
  const router = useRouter();
  const { draft, patchDraft } = usePublicOnboardingDraft();
  const [isSaving, setIsSaving] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setAdminName(draft.adminSetup?.adminName ?? "");
    setMobile(draft.adminSetup?.mobile ?? "");
    setPassword(draft.adminSetup?.password ?? "");
    setConfirmPassword(draft.adminSetup?.password ?? "");
  }, [draft.adminSetup]);

  async function onContinue() {
    if (!draft.token) {
      toast.error("Please complete earlier steps first.");
      router.push("/onboarding/school-info");
      return;
    }

    if (!adminName.trim() || !mobile.trim() || !password) {
      toast.error("Please complete all fields.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSaving(true);
    const result = await api.post<AdminCreateResponse>("/api/onboarding/admin-create", {
      token: draft.token,
      adminName,
      mobile,
      password,
    });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    patchDraft({
      adminSetup: {
        adminName,
        mobile,
        password,
      },
    });
    router.push("/onboarding/complete");
  }

  const authInputClass = "bg-background text-foreground placeholder:text-foreground/70";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="mb-1 text-xl font-semibold text-foreground">Admin User Creation</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Create the main admin account for your school.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="adminName" className="mb-1.5 block text-sm font-medium text-foreground">
            Admin Name
          </label>
          <Input
            id="adminName"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="Full name"
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="adminMobile" className="mb-1.5 block text-sm font-medium text-foreground">
            Mobile
          </label>
          <Input
            id="adminMobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="e.g. 03001234567"
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="adminPassword" className="mb-1.5 block text-sm font-medium text-foreground">
            Password
          </label>
          <Input
            id="adminPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-foreground">
            Confirm Password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Same as above"
            className={authInputClass}
          />
        </div>

        <div className="flex gap-2">
          <SxButton sxVariant="secondary" className="w-full" onClick={() => router.back()}>
            Back
          </SxButton>
          <SxButton sxVariant="primary" className="w-full" loading={isSaving} onClick={onContinue}>
            Continue
          </SxButton>
        </div>
      </div>
    </div>
  );
}

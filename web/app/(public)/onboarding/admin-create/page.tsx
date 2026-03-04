"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SxButton } from "@/components/sx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin User Creation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Admin Name</Label>
          <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Mobile</Label>
          <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Confirm Password</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
      </CardContent>
    </Card>
  );
}

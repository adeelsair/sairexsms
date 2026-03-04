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
import { cn } from "@/lib/utils";

type AcademicSetupResponse = {
  ok: boolean;
  token: string;
};

const CLASS_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

export default function AcademicSetupPage() {
  const router = useRouter();
  const { draft, patchDraft } = usePublicOnboardingDraft();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [sectionsPerClass, setSectionsPerClass] = useState("1");

  useEffect(() => {
    setSelectedClasses(draft.academicSetup?.classes ?? [1, 2, 3, 4, 5]);
    setSectionsPerClass(String(draft.academicSetup?.sectionsPerClass ?? 1));
  }, [draft.academicSetup]);

  function toggleClass(classNo: number) {
    setSelectedClasses((prev) =>
      prev.includes(classNo) ? prev.filter((x) => x !== classNo) : [...prev, classNo],
    );
  }

  async function onContinue() {
    if (!draft.token) {
      toast.error("Please complete school basics first.");
      router.push("/onboarding/school-info");
      return;
    }

    if (!selectedClasses.length) {
      toast.error("Please choose at least one class.");
      return;
    }

    const sections = Number(sectionsPerClass);
    if (!Number.isFinite(sections) || sections < 1 || sections > 10) {
      toast.error("Sections per class must be between 1 and 10.");
      return;
    }

    setIsSaving(true);
    const result = await api.post<AcademicSetupResponse>("/api/onboarding/academic-setup", {
      token: draft.token,
      classes: selectedClasses.sort((a, b) => a - b),
      sectionsPerClass: sections,
    });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    patchDraft({
      academicSetup: {
        classes: selectedClasses.sort((a, b) => a - b),
        sectionsPerClass: sections,
      },
    });
    router.push("/onboarding/fee-setup");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Academic Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Classes to start with</Label>
          <div className="grid grid-cols-5 gap-2">
            {CLASS_OPTIONS.map((classNo) => {
              const active = selectedClasses.includes(classNo);
              return (
                <button
                  key={classNo}
                  type="button"
                  onClick={() => toggleClass(classNo)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-sm",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background",
                  )}
                >
                  {classNo}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sections per class</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={sectionsPerClass}
            onChange={(e) => setSectionsPerClass(e.target.value)}
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

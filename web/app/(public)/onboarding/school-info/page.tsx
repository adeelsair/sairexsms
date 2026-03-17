"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SxButton } from "@/components/sx";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { usePublicOnboardingDraft } from "@/lib/hooks/usePublicOnboardingDraft";

type SchoolInfoResponse = {
  ok: boolean;
  token: string;
};

const STUDENT_OPTIONS = ["1-100", "101-300", "301-600", "601-1000", "1000+"] as const;

export default function SchoolInfoPage() {
  const router = useRouter();
  const { draft, patchDraft, ready } = usePublicOnboardingDraft();
  const [isSaving, setIsSaving] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [city, setCity] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [approxStudents, setApproxStudents] = useState<(typeof STUDENT_OPTIONS)[number]>("1-100");

  useEffect(() => {
    if (!ready) return;
    setSchoolName(draft.schoolInfo?.schoolName ?? "");
    setCity(draft.schoolInfo?.city ?? "");
    setContactNumber(draft.schoolInfo?.contactNumber ?? "");
    setApproxStudents(draft.schoolInfo?.approxStudents ?? "1-100");
  }, [draft.schoolInfo, ready]);

  async function onContinue() {
    if (!schoolName.trim() || !city.trim() || !contactNumber.trim()) {
      toast.error("Please complete all fields");
      return;
    }

    setIsSaving(true);
    const result = await api.post<SchoolInfoResponse>("/api/onboarding/school-info", {
      token: draft.token,
      schoolName,
      city,
      contactNumber,
      approxStudents,
    });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    patchDraft({
      token: result.data.token,
      schoolInfo: {
        schoolName,
        city,
        contactNumber,
        approxStudents,
      },
    });
    router.push("/onboarding/academic-setup");
  }

  const authInputClass = "bg-background text-foreground placeholder:text-foreground/70";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="mb-1 text-xl font-semibold text-foreground">School Basics</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Tell us about your school to get started.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="schoolName" className="mb-1.5 block text-sm font-medium text-foreground">
            School Name
          </label>
          <Input
            id="schoolName"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="e.g. City School"
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-foreground">
            City
          </label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Lahore"
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="contactNumber" className="mb-1.5 block text-sm font-medium text-foreground">
            Contact Number
          </label>
          <Input
            id="contactNumber"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            placeholder="e.g. 03001234567"
            className={authInputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Approx Students
          </label>
          <Select
            value={approxStudents}
            onValueChange={(value) =>
              setApproxStudents(value as (typeof STUDENT_OPTIONS)[number])
            }
          >
            <SelectTrigger className={authInputClass}>
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {STUDENT_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SxButton sxVariant="primary" className="w-full" loading={isSaving} onClick={onContinue}>
          Continue
        </SxButton>
      </div>
    </div>
  );
}

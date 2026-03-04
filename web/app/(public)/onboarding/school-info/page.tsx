"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SxButton } from "@/components/sx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>School Basics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>School Name</Label>
          <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Contact Number</Label>
          <Input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Approx Students</Label>
          <Select
            value={approxStudents}
            onValueChange={(value) =>
              setApproxStudents(value as (typeof STUDENT_OPTIONS)[number])
            }
          >
            <SelectTrigger>
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
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { SxButton } from "@/components/sx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";

type InviteResolveResponse = {
  tokenId: string;
  role: "PARENT" | "STAFF";
  expiresAt: string;
  maxUses: number | null;
  usedCount: number;
  hasPrefilledStudent: boolean;
  prefilledStudent: {
    id: number;
    fullName: string;
    admissionNo: string;
  } | null;
};

type OtpRequestResponse = {
  otpSessionId: string;
  expiresAt: string;
  channel: "mobile" | "whatsapp";
};

type InviteClaimResponse = {
  success: true;
  userId: number;
  role: "PARENT" | "STAFF";
  membershipId: number;
};

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [invite, setInvite] = useState<InviteResolveResponse | null>(null);
  const [phone, setPhone] = useState("");
  const [admissionNo, setAdmissionNo] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSessionId, setOtpSessionId] = useState("");
  const [step, setStep] = useState<"VALIDATE" | "PHONE" | "OTP">("VALIDATE");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("Missing invite token");
      setStep("PHONE");
      return;
    }

    const run = async () => {
      setIsBusy(true);
      const result = await api.get<InviteResolveResponse>(
        `/api/invite/resolve?token=${encodeURIComponent(token)}`,
      );
      setIsBusy(false);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setInvite(result.data);
      setStep("PHONE");
    };

    void run();
  }, [token]);

  async function sendOtp() {
    if (!phone.trim()) {
      toast.error("Please enter mobile number");
      return;
    }

    setIsBusy(true);
    const result = await api.post<OtpRequestResponse>("/api/auth/phone", {
      phone: phone.trim(),
      channel: "mobile",
    });
    setIsBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setOtpSessionId(result.data.otpSessionId);
    setStep("OTP");
    toast.success("OTP sent");
  }

  async function verifyAndJoin() {
    if (!otpSessionId || !otpCode.trim()) {
      toast.error("Enter OTP code");
      return;
    }

    if (!invite) {
      toast.error("Invite not found");
      return;
    }

    if (invite.role === "PARENT" && !invite.prefilledStudent && !admissionNo.trim()) {
      toast.error("Enter admission ID for child linking");
      return;
    }

    setIsBusy(true);
    const claim = await api.post<InviteClaimResponse>("/api/invite/claim", {
      token,
      otpSessionId,
      code: otpCode.trim(),
      admissionNo: admissionNo.trim() || undefined,
      studentId: invite.prefilledStudent?.id,
    });

    if (!claim.ok) {
      setIsBusy(false);
      toast.error(claim.error);
      return;
    }

    setIsBusy(false);

    toast.success("Joined successfully");
    router.push("/mobile/dashboard");
    router.refresh();
  }

  const roleText = invite?.role === "STAFF" ? "staff" : "parent";

  return (
    <div className="mx-auto max-w-md p-4">
      <Card>
        <CardHeader>
          <CardTitle>Join School</CardTitle>
          <p className="text-sm text-muted-foreground">
            Scan, verify phone, and enter your school in under a minute.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "VALIDATE" && (
            <p className="text-sm text-muted-foreground">Validating invite token...</p>
          )}

          {step !== "VALIDATE" && !invite && (
            <p className="text-sm text-destructive">Invite is invalid or expired.</p>
          )}

          {invite && (
            <>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Invite role: <span className="font-medium text-foreground">{roleText}</span>
              </div>

              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="03XXXXXXXXX"
                />
              </div>

              {invite.role === "PARENT" && (
                <>
                  {invite.prefilledStudent ? (
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                      Child linked:{" "}
                      <span className="font-medium text-foreground">
                        {invite.prefilledStudent.fullName} ({invite.prefilledStudent.admissionNo})
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Child Admission ID</Label>
                      <Input
                        value={admissionNo}
                        onChange={(event) => setAdmissionNo(event.target.value)}
                        placeholder="e.g. ADM-1023"
                      />
                    </div>
                  )}
                </>
              )}

              {step === "OTP" && (
                <div className="space-y-2">
                  <Label>OTP Code</Label>
                  <Input
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                    placeholder="Enter 6-digit code"
                  />
                </div>
              )}

              {step === "PHONE" && (
                <SxButton
                  sxVariant="primary"
                  className="w-full"
                  loading={isBusy}
                  onClick={sendOtp}
                >
                  Send OTP
                </SxButton>
              )}

              {step === "OTP" && (
                <SxButton
                  sxVariant="primary"
                  className="w-full"
                  loading={isBusy}
                  onClick={verifyAndJoin}
                >
                  Verify & Join
                </SxButton>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Loader2,
  Send,
} from "lucide-react";

import { api } from "@/lib/api-client";
import {
  onboardingContactAddressSchema,
  type OnboardingContactAddressInput,
} from "@/lib/validations/onboarding";
import { PAKISTAN_PROVINCES } from "@/lib/validations";
import { getDistricts, getTehsils, getCities } from "@/lib/data/pakistan-geo";
import { useOnboarding, type VerifiableField } from "../context";

import { SxButton } from "@/components/sx";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// ─── Inline Verification Component ──────────────────────────────────────────

type Channel = "email" | "mobile" | "whatsapp";

interface VerifyInlineProps {
  channel: Channel;
  field: VerifiableField;
  value: string;
  isVerified: boolean;
  onVerified: (verifiedAt?: string) => void;
}

function VerifyInline({
  channel,
  field,
  value,
  isVerified,
  onVerified,
}: VerifyInlineProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Reset state if the value changes after OTP was sent
  useEffect(() => {
    if (otpSent) {
      setOtpSent(false);
      setOtp("");
      setDevCode(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (isVerified) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <CheckCircle2 size={14} />
        Verified
      </span>
    );
  }

  const minLength = channel === "email" ? 5 : 7;
  if (!value || value.length < minLength) return null;

  const sendOtp = async () => {
    setSending(true);
    const result = await api.post<{ sent: boolean; devCode?: string }>(
      "/api/onboarding/verify/send",
      { channel, target: value },
    );
    setSending(false);

    if (result.ok) {
      setOtpSent(true);
      setCooldown(60);
      if (result.data.devCode) {
        setDevCode(result.data.devCode);
      }
      toast.success(`Verification code sent to ${value}`);
    } else {
      toast.error(result.error);
    }
  };

  const confirmOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setConfirming(true);
    const result = await api.post<{ verified: boolean; verifiedAt?: string }>(
      "/api/onboarding/verify/confirm",
      { channel, target: value, code: otp },
    );
    setConfirming(false);

    if (result.ok && result.data.verified) {
      onVerified(result.data.verifiedAt);
      toast.success(`${channel === "email" ? "Email" : channel === "mobile" ? "Mobile" : "WhatsApp"} verified!`);
    } else {
      toast.error(result.ok ? "Verification failed" : result.error);
    }
  };

  if (!otpSent) {
    return (
      <button
        type="button"
        disabled={sending || cooldown > 0}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        onClick={sendOtp}
      >
        {sending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Send size={12} />
        )}
        {cooldown > 0 ? `Resend (${cooldown}s)` : "Verify"}
      </button>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <Input
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="6-digit code"
        className="h-8 w-32 font-mono text-sm tracking-widest"
      />
      <button
        type="button"
        disabled={confirming || otp.length !== 6}
        className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        onClick={confirmOtp}
      >
        {confirming ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
      </button>
      <button
        type="button"
        disabled={sending || cooldown > 0}
        className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
        onClick={sendOtp}
      >
        {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend"}
      </button>
      {devCode && (
        <span className="text-[10px] text-muted-foreground">
          Dev: {devCode}
        </span>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OnboardingContactAddressPage() {
  const router = useRouter();
  const { draft, saveStep, markValidated, isFieldVerified, markFieldVerified, userEmail } =
    useOnboarding();

  const form = useForm<OnboardingContactAddressInput>({
    resolver: zodResolver(onboardingContactAddressSchema),
    defaultValues: draft.contactAddress ?? {
      addressLine1: "",
      addressLine2: "",
      country: "Pakistan",
      provinceState: "",
      district: "",
      tehsil: "",
      city: "",
      postalCode: "",
      organizationEmail: "",
      organizationPhone: "",
      organizationMobile: "",
      organizationWhatsApp: "",
    },
  });

  const { handleSubmit, watch, setValue } = form;

  const selectedProvince = watch("provinceState");
  const selectedDistrict = watch("district");
  const selectedTehsil = watch("tehsil");

  const emailValue = watch("organizationEmail");
  const mobileValue = watch("organizationMobile");
  const whatsAppValue = watch("organizationWhatsApp");

  // Auto-verify email if it matches the logged-in user's verified email
  const autoVerifyEmail = useCallback(() => {
    if (
      userEmail &&
      emailValue &&
      emailValue.toLowerCase().trim() === userEmail.toLowerCase().trim() &&
      !isFieldVerified("organizationEmail", emailValue)
    ) {
      markFieldVerified("organizationEmail", emailValue, "email");
    }
  }, [userEmail, emailValue, isFieldVerified, markFieldVerified]);

  useEffect(() => {
    autoVerifyEmail();
  }, [autoVerifyEmail]);

  const districts = useMemo(() => getDistricts(selectedProvince), [selectedProvince]);
  const tehsils = useMemo(() => getTehsils(selectedProvince, selectedDistrict), [selectedProvince, selectedDistrict]);
  const cities = useMemo(() => getCities(selectedProvince, selectedDistrict, selectedTehsil), [selectedProvince, selectedDistrict, selectedTehsil]);

  const onProvinceChange = (value: string, fieldOnChange: (v: string) => void) => {
    fieldOnChange(value);
    setValue("district", "");
    setValue("tehsil", "");
    setValue("city", "");
  };

  const onDistrictChange = (value: string, fieldOnChange: (v: string) => void) => {
    fieldOnChange(value);
    setValue("tehsil", "");
    setValue("city", "");
  };

  const onTehsilChange = (value: string, fieldOnChange: (v: string) => void) => {
    fieldOnChange(value);
    setValue("city", "");
  };

  const onBack = () => {
    saveStep("contactAddress", form.getValues());
    router.push("/onboarding/legal");
  };

  const onSave = (data: OnboardingContactAddressInput) => {
    saveStep("contactAddress", data);
    markValidated("contactAddress");
    toast.success("Contact & address saved");
  };

  const onNext = (data: OnboardingContactAddressInput) => {
    saveStep("contactAddress", data);
    markValidated("contactAddress");
    router.push("/onboarding/branding");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-lg">
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        HO Address & Contacts
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Provide your organization&apos;s head office address and contact
        information.
      </p>

      <Form {...form}>
        <form className="space-y-6">
          {/* ── Address Section ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Head Office Address
            </h3>

            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123 Main Boulevard, DHA Phase 5"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2 (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Suite, floor, building" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="Pakistan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="provinceState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => onProvinceChange(v, field.onChange)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select province" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAKISTAN_PROVINCES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => onDistrictChange(v, field.onChange)}
                      disabled={!selectedProvince}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={selectedProvince ? "Select district" : "Select province first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {districts.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tehsil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tehsil</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => onTehsilChange(v, field.onChange)}
                      disabled={!selectedDistrict}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={selectedDistrict ? "Select tehsil" : "Select district first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tehsils.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedTehsil}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={selectedTehsil ? "Select city" : "Select tehsil first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cities.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="54000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* ── Contact Section ── */}
          <div className="space-y-4 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground">
              Organization Contact
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="organizationEmail"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Official Email</FormLabel>
                      <VerifyInline
                        channel="email"
                        field="organizationEmail"
                        value={emailValue}
                        isVerified={isFieldVerified("organizationEmail", emailValue)}
                        onVerified={(verifiedAt) => markFieldVerified("organizationEmail", emailValue, "email", verifiedAt)}
                      />
                    </div>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="info@school.edu.pk"
                        {...field}
                      />
                    </FormControl>
                    {isFieldVerified("organizationEmail", emailValue) &&
                      userEmail &&
                      emailValue.toLowerCase().trim() === userEmail.toLowerCase().trim() && (
                        <p className="text-[11px] text-muted-foreground">
                          Auto-verified (same as your account email)
                        </p>
                      )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="organizationPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Land Line Number</FormLabel>
                    <FormControl>
                      <Input placeholder="042-1234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="organizationMobile"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Mobile Number</FormLabel>
                      <VerifyInline
                        channel="mobile"
                        field="organizationMobile"
                        value={mobileValue}
                        isVerified={isFieldVerified("organizationMobile", mobileValue)}
                        onVerified={(verifiedAt) => markFieldVerified("organizationMobile", mobileValue, "mobile", verifiedAt)}
                      />
                    </div>
                    <FormControl>
                      <Input placeholder="+923001234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="organizationWhatsApp"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>WhatsApp (Optional)</FormLabel>
                      <VerifyInline
                        channel="whatsapp"
                        field="organizationWhatsApp"
                        value={whatsAppValue ?? ""}
                        isVerified={isFieldVerified("organizationWhatsApp", whatsAppValue ?? "")}
                        onVerified={(verifiedAt) => markFieldVerified("organizationWhatsApp", whatsAppValue ?? "", "whatsapp", verifiedAt)}
                      />
                    </div>
                    <FormControl>
                      <Input placeholder="+923001234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center justify-between pt-2">
            <SxButton
              type="button"
              sxVariant="ghost"
              icon={<ArrowLeft size={16} />}
              onClick={onBack}
            >
              Back
            </SxButton>
            <div className="flex gap-3">
              <SxButton
                type="button"
                sxVariant="outline"
                icon={<Save size={16} />}
                onClick={handleSubmit(onSave)}
              >
                Save
              </SxButton>
              <SxButton
                type="button"
                sxVariant="primary"
                icon={<ArrowRight size={16} />}
                onClick={handleSubmit(onNext)}
              >
                Next
              </SxButton>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

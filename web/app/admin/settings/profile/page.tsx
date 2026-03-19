"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Check, Eye, FileText, Pencil, X } from "lucide-react";
import { z } from "zod";

import { api } from "@/lib/api-client";
import {
  onboardingBrandingSchema,
  onboardingContactAddressSchema,
  onboardingIdentitySchema,
  onboardingLegalSchema,
  ONBOARDING_ORGANIZATION_CATEGORY,
  ONBOARDING_ORGANIZATION_STRUCTURE,
} from "@/lib/validations/onboarding";
import {
  SxPageHeader,
  SxButton,
  SxStatusBadge,
  SxFormSection,
  SxFormLayout,
  SxFormCard,
} from "@/components/sx";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const profileSchema = z.object({
  identity: onboardingIdentitySchema,
  legal: onboardingLegalSchema.omit({
    registrationCertificate: true,
    registrationCertName: true,
    ntnCertificate: true,
    ntnCertName: true,
  }),
  contactAddress: onboardingContactAddressSchema,
  branding: onboardingBrandingSchema,
});

type ProfileFormInput = z.input<typeof profileSchema>;

interface ProfileEnvelope {
  ok: true;
  organization: { id: string; slug: string; onboardingStep: string };
  profile: ProfileFormInput;
  legalCertificates?: {
    registration: { url: string | null; name: string | null };
    ntn: { url: string | null; name: string | null };
  };
}

type SectionKey = keyof ProfileFormInput;

const SECTION_META: Record<SectionKey, { title: string; description: string; columns: 1 | 2 | 3 }> = {
  identity: {
    title: "Organization identity",
    description: "These fields appear on invoices, challans, and admin screens.",
    columns: 2,
  },
  legal: {
    title: "Legal information",
    description: "Used for compliance and verification.",
    columns: 2,
  },
  contactAddress: {
    title: "HQ address & contacts",
    description: "Used for official communications and billing.",
    columns: 2,
  },
  branding: {
    title: "Branding",
    description: "Website and logo used across the product.",
    columns: 2,
  },
};

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\\b\\w/g, (c) => c.toUpperCase());
}

function inferInputType(section: SectionKey, fieldKey: string): "text" | "email" | "url" | "date" | "textarea" {
  if (fieldKey.toLowerCase().includes("email")) return "email";
  if (fieldKey.toLowerCase().includes("url")) return "url";
  if (fieldKey.toLowerCase().endsWith("date")) return "date";
  if (section === "contactAddress" && (fieldKey === "addressLine1" || fieldKey === "addressLine2")) return "textarea";
  return "text";
}

function isSelectField(section: SectionKey, fieldKey: string): boolean {
  return section === "identity" && (fieldKey === "organizationCategory" || fieldKey === "organizationStructure");
}

function CertificateRow({
  label,
  name,
  url,
}: {
  label: string;
  name: string | null;
  url: string | null;
}) {
  const hasUrl = Boolean(url);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-0.5 overflow-hidden text-ellipsis break-all text-sm text-foreground">
          {name || (hasUrl ? "Uploaded certificate" : "—")}
        </div>
      </div>
      <SxButton
        type="button"
        sxVariant="outline"
        size="sm"
        icon={<Eye size={14} />}
        disabled={!hasUrl}
        onClick={() => {
          if (!url) return;
          window.open(url, "_blank", "noopener,noreferrer");
        }}
        className="shrink-0"
      >
        View
      </SxButton>
    </div>
  );
}

export default function SettingsProfilePage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<ProfileEnvelope["organization"] | null>(null);
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [loadedProfile, setLoadedProfile] = useState<ProfileFormInput | null>(null);
  const [legalCertificates, setLegalCertificates] = useState<
    ProfileEnvelope["legalCertificates"] | null
  >(null);

  const form = useForm<ProfileFormInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      identity: {
        organizationName: "",
        displayName: "",
        organizationCategory: "SCHOOL",
        organizationStructure: "SINGLE",
      },
      legal: {
        registrationNumber: "",
        taxNumber: "",
        establishedDate: "",
      },
      contactAddress: {
        addressLine1: "",
        addressLine2: "",
        country: "",
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
      branding: {
        logoUrl: "",
        websiteUrl: "",
        logoVariants: [],
      },
    },
    mode: "onSubmit",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const result = await api.get<ProfileEnvelope>("/api/admin/profile");
    if (result.ok) {
      setOrg(result.data.organization);
      setLegalCertificates(result.data.legalCertificates ?? null);
      setLoadedProfile(result.data.profile);
      form.reset(result.data.profile);
      setLoading(false);
      return;
    }

    toast.error(result.error);
    setLoading(false);
  }, [form]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveAll = useCallback(async (): Promise<boolean> => {
    const data = form.getValues();
    const result = await api.patch<
      { ok: true } | { ok: false; fieldErrors?: Record<string, string[]>; error: string }
    >("/api/admin/profile", data);

    if (result.ok) {
      toast.success("Profile updated");
      await load();
      return true;
    }

    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        form.setError(field as never, { message: messages?.[0] });
      }
      toast.error("Please fix the validation errors");
      return false;
    }

    toast.error(result.error);
    return false;
  }, [form, load]);

  const cancelSection = useCallback(
    (sectionKey: SectionKey) => {
      if (!loadedProfile) {
        setEditingSection(null);
        return;
      }

      const sectionSchema = profileSchema.shape[sectionKey];
      if (!(sectionSchema instanceof z.ZodObject)) {
        setEditingSection(null);
        return;
      }

      const fieldKeys = Object.keys(sectionSchema.shape) as string[];
      for (const fieldKey of fieldKeys) {
        const name = `${sectionKey}.${fieldKey}` as const;
        const v = (loadedProfile as Record<string, Record<string, unknown>>)?.[sectionKey]?.[fieldKey];
        form.setValue(name as never, (v ?? "") as never, { shouldDirty: false });
      }
      form.clearErrors();
      setEditingSection(null);
    },
    [form, loadedProfile],
  );

  return (
    <SxFormLayout>
      <SxPageHeader
        title="Profile"
        subtitle="View and update your organization profile (same fields as onboarding)."
        actions={
          <SxButton asChild sxVariant="outline" icon={<ArrowLeft size={16} />}>
            <Link href="/admin/settings">Back to Settings</Link>
          </SxButton>
        }
      />

      <SxFormCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-foreground">Current organization</div>
            <div className="font-data text-xs text-muted-foreground">
              {org ? `${org.id} • ${org.slug}` : loading ? "Loading…" : "—"}
            </div>
          </div>
          <SxStatusBadge
            variant={org?.onboardingStep === "COMPLETED" ? "success" : "warning"}
          >
            {org?.onboardingStep ?? "—"}
          </SxStatusBadge>
        </div>
      </SxFormCard>

      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <SxFormCard className="space-y-8">
            {(Object.keys(profileSchema.shape) as SectionKey[]).map((sectionKey) => {
              const sectionSchema = profileSchema.shape[sectionKey];
              if (!(sectionSchema instanceof z.ZodObject)) return null;

              const fieldKeys = Object.keys(sectionSchema.shape) as string[];
              const isEditingThis = editingSection === sectionKey;
              const isEditingOther = editingSection !== null && editingSection !== sectionKey;

              return (
                <SxFormSection
                  key={sectionKey}
                  title={SECTION_META[sectionKey].title}
                  description={SECTION_META[sectionKey].description}
                  columns={SECTION_META[sectionKey].columns}
                  actions={
                    isEditingThis ? (
                      <div className="flex items-center gap-2">
                        <SxButton
                          type="button"
                          icon={<Check size={16} />}
                          loading={form.formState.isSubmitting}
                          onClick={async () => {
                            const names = fieldKeys.map((k) => `${sectionKey}.${k}` as const);
                            const ok = await form.trigger(names as never, { shouldFocus: true });
                            if (!ok) return;
                            form.clearErrors();
                            const saved = await saveAll();
                            if (saved) setEditingSection(null);
                          }}
                        >
                          Save
                        </SxButton>
                        <SxButton
                          type="button"
                          sxVariant="outline"
                          icon={<X size={16} />}
                          disabled={form.formState.isSubmitting}
                          onClick={() => cancelSection(sectionKey)}
                        >
                          Cancel
                        </SxButton>
                      </div>
                    ) : (
                      <SxButton
                        type="button"
                        sxVariant="outline"
                        icon={<Pencil size={16} />}
                        disabled={loading || isEditingOther}
                        onClick={() => setEditingSection(sectionKey)}
                      >
                        Edit
                      </SxButton>
                    )
                  }
                >
                  {fieldKeys.map((fieldKey) => {
                    const name = `${sectionKey}.${fieldKey}` as const;
                    const label = humanizeKey(fieldKey);
                    const type = inferInputType(sectionKey, fieldKey);
                    const disabled = loading || isEditingOther || !isEditingThis;

                    if (isSelectField(sectionKey, fieldKey)) {
                      const options =
                        fieldKey === "organizationCategory"
                          ? ONBOARDING_ORGANIZATION_CATEGORY
                          : ONBOARDING_ORGANIZATION_STRUCTURE;

                      return (
                        <FormField
                          key={name}
                          control={form.control}
                          name={name as never}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{label}</FormLabel>
                              <Select
                                value={String(field.value ?? "")}
                                onValueChange={field.onChange}
                                disabled={disabled}
                              >
                                <FormControl>
                                  <SelectTrigger className="bg-background">
                                    <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {options.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {humanizeKey(opt)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      );
                    }

                    return (
                      <FormField
                        key={name}
                        control={form.control}
                        name={name as never}
                        render={({ field }) => (
                          <FormItem className={type === "textarea" ? "sm:col-span-2" : undefined}>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                              {type === "textarea" ? (
                                <Textarea
                                  value={String(field.value ?? "")}
                                  onChange={field.onChange}
                                  placeholder={label}
                                  disabled={disabled}
                                  className="min-h-20 bg-background"
                                />
                              ) : (
                                <Input
                                  type={type}
                                  value={String(field.value ?? "")}
                                  onChange={field.onChange}
                                  placeholder={label}
                                  disabled={disabled}
                                  className="bg-background"
                                />
                              )}
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    );
                  })}

                  {sectionKey === "legal" ? (
                    <div className="sm:col-span-2">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" size={16} />
                          <div className="text-sm font-medium text-foreground">Certificates</div>
                        </div>
                        <CertificateRow
                          label="Registration Certificate"
                          name={legalCertificates?.registration.name ?? null}
                          url={legalCertificates?.registration.url ?? null}
                        />
                        <CertificateRow
                          label="NTN Certificate"
                          name={legalCertificates?.ntn.name ?? null}
                          url={legalCertificates?.ntn.url ?? null}
                        />
                      </div>
                    </div>
                  ) : null}
                </SxFormSection>
              );
            })}
          </SxFormCard>
        </form>
      </Form>
    </SxFormLayout>
  );
}


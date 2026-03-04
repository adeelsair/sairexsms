"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Pencil, FileText, ScrollText } from "lucide-react";

import { api } from "@/lib/api-client";
import { useOnboarding, type CompletedOrg } from "../context";
import { SxButton } from "@/components/sx";
import { Checkbox } from "@/components/ui/checkbox";

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Section({
  title,
  editPath,
  children,
}: {
  title: string;
  editPath: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <SxButton
          type="button"
          sxVariant="ghost"
          size="sm"
          icon={<Pencil size={14} />}
          onClick={() => router.push(editPath)}
        >
          Edit
        </SxButton>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 py-4 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

export default function OnboardingPreviewPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const { draft, setCompletedOrg, clearDraft } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedDataPolicy, setAcceptedDataPolicy] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const { identity, legal, contactAddress, branding } = draft;

  const allComplete = identity && legal && contactAddress;
  const canSubmit = allComplete && acceptedTerms && acceptedDataPolicy;

  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    if (atBottom) setScrolledToBottom(true);
  };

  const onBack = () => {
    router.push("/onboarding/branding");
  };

  const onComplete = async () => {
    if (!allComplete) {
      toast.error("Please complete all steps before submitting");
      return;
    }
    if (!acceptedTerms || !acceptedDataPolicy) {
      toast.error("Please accept the Terms & Conditions and Data Policy");
      return;
    }

    setSubmitting(true);
    const result = await api.post<CompletedOrg>("/api/onboarding/complete", {
      identity,
      legal,
      contactAddress,
      branding: branding ?? { logoUrl: "" },
    });

    if (result.ok) {
      setCompletedOrg(result.data);
      clearDraft();

      if (result.data.membership) {
        await updateSession({
          role: result.data.membership.role,
          organizationId: result.data.membership.organizationId,
          membershipId: result.data.membership.id,
          organizationStructure: result.data.membership.organizationStructure,
          campusId: result.data.membership.campusId,
        });
      }

      toast.success("Organization registered successfully!");
      router.push("/onboarding/confirmation");
    } else if (result.fieldErrors) {
      toast.error("Validation errors — please go back and fix them");
      setSubmitting(false);
    } else {
      toast.error(result.error);
      setSubmitting(false);
    }
  };

  if (!identity) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-lg">
        <p className="text-muted-foreground">
          No data to preview. Please start from the first step.
        </p>
        <SxButton
          type="button"
          sxVariant="primary"
          className="mt-4"
          onClick={() => router.push("/onboarding/identity")}
        >
          Start Onboarding
        </SxButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="mb-1 text-xl font-semibold text-foreground">
          Review Your Information
        </h2>
        <p className="text-sm text-muted-foreground">
          Please review all details carefully. Your Organization ID will be
          generated after you confirm.
        </p>
      </div>

      {/* ── Identity ── */}
      <Section title="Organization Identity" editPath="/onboarding/identity">
        <Field label="Organization Name" value={identity.organizationName} />
        <Field label="Display Name" value={identity.displayName} />
        <Field label="Category" value={humanize(identity.organizationCategory)} />
        <Field label="Structure" value={humanize(identity.organizationStructure)} />
      </Section>

      {/* ── Legal ── */}
      <Section title="Registration Information" editPath="/onboarding/legal">
        {legal ? (
          <>
            <Field label="Registration Number" value={legal.registrationNumber} />
            <Field label="Tax / NTN Number" value={legal.taxNumber} />
            <Field label="Established Date" value={legal.establishedDate} />
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Registration Certificate</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {legal.registrationCertName ? (
                  <span className="inline-flex items-center gap-1.5">
                    <FileText size={14} className="text-primary" />
                    {legal.registrationCertName}
                  </span>
                ) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">NTN Certificate</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {legal.ntnCertName ? (
                  <span className="inline-flex items-center gap-1.5">
                    <FileText size={14} className="text-primary" />
                    {legal.ntnCertName}
                  </span>
                ) : "—"}
              </dd>
            </div>
          </>
        ) : (
          <p className="col-span-2 text-sm text-destructive">Not completed yet</p>
        )}
      </Section>

      {/* ── Contact & Address ── */}
      <Section title="HO Address & Contacts" editPath="/onboarding/contact-address">
        {contactAddress ? (
          <>
            <Field label="Street Address" value={contactAddress.addressLine1} />
            <Field label="Address Line 2" value={contactAddress.addressLine2} />
            <Field label="Country" value={contactAddress.country} />
            <Field label="Province" value={contactAddress.provinceState} />
            <Field label="District" value={contactAddress.district} />
            <Field label="Tehsil" value={contactAddress.tehsil} />
            <Field label="City" value={contactAddress.city} />
            <Field label="Postal Code" value={contactAddress.postalCode} />
            <Field label="Official Email" value={contactAddress.organizationEmail} />
            <Field label="Land Line Number" value={contactAddress.organizationPhone} />
            <Field label="Mobile Number" value={contactAddress.organizationMobile} />
            <Field label="WhatsApp" value={contactAddress.organizationWhatsApp} />
          </>
        ) : (
          <p className="col-span-2 text-sm text-destructive">Not completed yet</p>
        )}
      </Section>

      {/* ── Branding ── */}
      <Section title="Branding" editPath="/onboarding/branding">
        <Field label="Website" value={branding?.websiteUrl} />
        <Field label="Logo URL" value={branding?.logoUrl} />
      </Section>

      {/* ── Terms & Conditions ── */}
      <div className="rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <ScrollText size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Terms &amp; Conditions
          </h3>
        </div>

        <div
          className="mx-5 mt-4 max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground"
          onScroll={handleTermsScroll}
        >
          <p className="mb-3 font-semibold text-foreground">
            SAIREX SMS — Terms of Service &amp; Acceptable Use Policy
          </p>

          <p className="mb-2">
            <strong>1. Acceptance of Terms.</strong> By completing this
            registration, you ("Organization") agree to be bound by these Terms
            of Service, the SAIREX SMS Privacy Policy, and all applicable laws
            and regulations. If you do not agree to these terms, do not proceed
            with registration.
          </p>

          <p className="mb-2">
            <strong>2. Service Description.</strong> SAIREX SMS provides a
            cloud-based School Management System ("SMS") including but not
            limited to student management, fee management, attendance tracking,
            campus administration, and communication tools. The Platform is
            offered on a Software-as-a-Service (SaaS) basis.
          </p>

          <p className="mb-2">
            <strong>3. Account Responsibilities.</strong> You are responsible for
            maintaining the confidentiality of your account credentials, ensuring
            the accuracy of all information provided during registration, all
            activities that occur under your account, and compliance with all
            applicable education and data protection regulations.
          </p>

          <p className="mb-2">
            <strong>4. Data Ownership &amp; Processing.</strong> All student,
            staff, and organizational data entered into the Platform remains the
            property of the Organization. SAIREX processes data solely for the
            purpose of providing the Service. SAIREX will not sell, share, or
            disclose Organization data to third parties except as required by law
            or with explicit consent.
          </p>

          <p className="mb-2">
            <strong>5. Data Protection.</strong> SAIREX implements
            industry-standard security measures including encryption at rest and
            in transit, role-based access control, audit logging, and regular
            security assessments. Organizations must implement proper access
            controls within their accounts to protect sensitive student data.
          </p>

          <p className="mb-2">
            <strong>6. Acceptable Use.</strong> You agree not to use the Platform
            for any unlawful purpose, transmit harmful or malicious content,
            attempt to gain unauthorized access to any part of the Service, or
            use automated systems to access the Platform without permission.
          </p>

          <p className="mb-2">
            <strong>7. Service Level.</strong> SAIREX targets 99.5% monthly
            uptime. Scheduled maintenance windows will be communicated in
            advance. SAIREX is not liable for downtime caused by factors beyond
            its reasonable control.
          </p>

          <p className="mb-2">
            <strong>8. Fees &amp; Billing.</strong> Service fees are as per your
            subscription plan. SAIREX reserves the right to modify pricing with
            30 days prior notice. Non-payment may result in service suspension.
          </p>

          <p className="mb-2">
            <strong>9. Termination.</strong> Either party may terminate the
            agreement with 30 days written notice. Upon termination, SAIREX will
            provide a data export within 30 days. After 90 days post-termination,
            all Organization data will be permanently deleted.
          </p>

          <p>
            <strong>10. Governing Law.</strong> These terms shall be governed by
            and construed in accordance with the laws of Pakistan. Any disputes
            shall be resolved through arbitration in Lahore, Pakistan.
          </p>
        </div>

        {!scrolledToBottom && (
          <p className="mx-5 mt-2 text-[10px] italic text-muted-foreground">
            Please scroll to the bottom to read the full terms before accepting.
          </p>
        )}

        <div className="space-y-3 px-5 py-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={acceptedTerms}
              onCheckedChange={(v) => setAcceptedTerms(v === true)}
              disabled={!scrolledToBottom}
            />
            <span className="text-sm text-foreground leading-tight">
              I have read and agree to the{" "}
              <strong>Terms of Service</strong> and{" "}
              <strong>Acceptable Use Policy</strong> of SAIREX SMS.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={acceptedDataPolicy}
              onCheckedChange={(v) => setAcceptedDataPolicy(v === true)}
              disabled={!scrolledToBottom}
            />
            <span className="text-sm text-foreground leading-tight">
              I acknowledge that all data provided is accurate and I consent to
              its processing as described in the{" "}
              <strong>Data Protection</strong> clause above.
            </span>
          </label>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-6 py-4 shadow-lg">
        <SxButton
          type="button"
          sxVariant="ghost"
          icon={<ArrowLeft size={16} />}
          onClick={onBack}
        >
          Back
        </SxButton>
        <SxButton
          type="button"
          sxVariant="primary"
          icon={<CheckCircle2 size={16} />}
          loading={submitting}
          disabled={!canSubmit}
          onClick={onComplete}
        >
          Complete Registration
        </SxButton>
      </div>
    </div>
  );
}

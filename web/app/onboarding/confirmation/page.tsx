"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Printer,
  Download,
  Mail,
  ArrowRight,
  FileText,
  Loader2,
  PartyPopper,
} from "lucide-react";

import { useOnboarding } from "../context";
import { SxButton } from "@/components/sx";

export default function OnboardingConfirmationPage() {
  const router = useRouter();
  const { completedOrg } = useOnboarding();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);

  useEffect(() => {
    if (!completedOrg) {
      router.replace("/onboarding/identity");
    }
  }, [completedOrg, router]);

  useEffect(() => {
    if (!completedOrg) return;
    setPdfLoading(true);
    const url = `/api/onboarding/certificate?orgId=${encodeURIComponent(completedOrg.id)}`;
    setPdfUrl(url);
    setPdfLoading(false);
  }, [completedOrg]);

  if (!completedOrg) return null;

  const certUrl = `/api/onboarding/certificate?orgId=${encodeURIComponent(completedOrg.id)}`;

  const onPrint = () => {
    const win = window.open(certUrl, "_blank");
    if (win) {
      win.addEventListener("load", () => {
        setTimeout(() => win.print(), 500);
      });
    }
  };

  const onDownload = () => {
    toast.info("Preparing PDF download...");
    const link = document.createElement("a");
    link.href = certUrl;
    link.download = `${completedOrg.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("PDF download started");
  };

  const onEmail = () => {
    toast.info("Email feature coming soon");
  };

  const onDashboard = () => {
    router.push("/admin/dashboard");
    router.refresh();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* ── Congratulations Banner ── */}
      <div className="rounded-lg border border-success/30 bg-success/10 p-6 text-center">
        <PartyPopper className="mx-auto mb-3 h-10 w-10 text-success" />
        <h2 className="text-xl font-bold text-foreground">
          Congratulations!
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{completedOrg.organizationName}</span>{" "}
          has been successfully registered on SAIREX SMS.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-dashed border-primary/30 bg-primary/5 px-5 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Organization ID
          </span>
          <span className="font-data text-lg font-bold tracking-wider text-primary">
            {completedOrg.id}
          </span>
        </div>
      </div>

      {/* ── PDF Preview ── */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
          <FileText size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Registration Certificate
          </span>
          
        </div>

        {pdfLoading ? (
          <div className="flex h-[500px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="h-[500px] w-full border-0"
            title="Registration Certificate PDF"
          />
        ) : (
          <div className="flex h-[500px] items-center justify-center text-sm text-muted-foreground">
            Failed to load certificate preview
          </div>
        )}
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-6 py-4 shadow-lg print:hidden">
        <div className="flex gap-2">
          <SxButton
            type="button"
            sxVariant="outline"
            icon={<Printer size={16} />}
            onClick={onPrint}
          >
            Print
          </SxButton>
          <SxButton
            type="button"
            sxVariant="outline"
            icon={<Download size={16} />}
            onClick={onDownload}
          >
            Download
          </SxButton>
          <SxButton
            type="button"
            sxVariant="outline"
            icon={<Mail size={16} />}
            onClick={onEmail}
          >
            Email
          </SxButton>
        </div>
        <SxButton
          type="button"
          sxVariant="primary"
          icon={<ArrowRight size={16} />}
          onClick={onDashboard}
        >
          Go to Dashboard
        </SxButton>
      </div>
    </div>
  );
}

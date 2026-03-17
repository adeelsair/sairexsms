"use client";

import { useEffect, useState, useRef } from "react";
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
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!completedOrg) {
      router.replace("/onboarding/identity");
    }
  }, [completedOrg, router]);

  useEffect(() => {
    if (!completedOrg) return;
    setPdfLoading(true);
    setPdfError(null);
    const url = `/api/onboarding/certificate?orgId=${encodeURIComponent(completedOrg.id)}`;

    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "Access denied" : "Failed to load certificate");
        return res.blob();
      })
      .then((blob) => {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setPdfBlobUrl(blobUrl);
      })
      .catch((err) => {
        setPdfError(err instanceof Error ? err.message : "Failed to load certificate");
        setPdfBlobUrl(null);
      })
      .finally(() => setPdfLoading(false));

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [completedOrg]);

  if (!completedOrg) return null;

  const onPrint = () => {
    if (pdfBlobUrl) {
      const win = window.open(pdfBlobUrl, "_blank");
      if (win) {
        win.addEventListener("load", () => {
          setTimeout(() => win.print(), 500);
        });
      }
    } else {
      toast.error("Certificate not loaded yet");
    }
  };

  const onDownload = () => {
    if (pdfBlobUrl) {
      toast.info("Preparing PDF download...");
      const link = document.createElement("a");
      link.href = pdfBlobUrl;
      link.download = `${completedOrg.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("PDF download started");
    } else {
      toast.error("Certificate not loaded yet");
    }
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
      <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center">
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
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
        ) : pdfError ? (
          <div className="flex h-[500px] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <FileText className="h-10 w-10 text-muted-foreground/50" />
            <p>{pdfError}</p>
          </div>
        ) : pdfBlobUrl ? (
          <iframe
            src={pdfBlobUrl}
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-6 py-4 shadow-sm print:hidden">
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

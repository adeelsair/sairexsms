"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Save, Upload, X, FileText, Eye } from "lucide-react";

import {
  onboardingLegalSchema,
  type OnboardingLegalInput,
} from "@/lib/validations/onboarding";
import { useOnboarding } from "../context";

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

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isImageDataUrl(url: string): boolean {
  return url.startsWith("data:image/");
}

function openFilePreview(dataUrl: string, fileName: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  if (isImageDataUrl(dataUrl)) {
    w.document.write(
      `<html><head><title>${fileName}</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111"><img src="${dataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`,
    );
  } else {
    w.document.write(
      `<html><head><title>${fileName}</title></head><body style="margin:0"><iframe src="${dataUrl}" style="width:100%;height:100vh;border:none"></iframe></body></html>`,
    );
  }
  w.document.close();
}

interface CertUploadBtnProps {
  onUpload: (dataUrl: string, name: string) => void;
  hasFile: boolean;
}

function CertUploadBtn({ onUpload, hasFile }: CertUploadBtnProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Only PDF, JPG, JPEG, and PNG files are allowed");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File exceeds 2 MB limit (${formatFileSize(file.size)})`);
      return;
    }

    const result = await fileToDataUrl(file);
    onUpload(result, file.name);

    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <button
        type="button"
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
        onClick={() => inputRef.current?.click()}
        title="Upload PDF, JPG, or PNG (max 2 MB)"
      >
        <Upload size={14} />
        {hasFile ? "Replace" : "Upload"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
}

interface CertPreviewProps {
  label: string;
  fileName: string | undefined;
  dataUrl: string | undefined;
  onRemove: () => void;
}

function CertPreview({ label, fileName, dataUrl, onRemove }: CertPreviewProps) {
  if (!fileName || !dataUrl) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-4">
        <FileText size={24} className="mb-1 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground/60">No file uploaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-border bg-muted/20">
      <button
        type="button"
        className="flex flex-1 items-center justify-center p-2"
        onClick={() => openFilePreview(dataUrl, fileName)}
        title="Click to preview"
      >
        {isImageDataUrl(dataUrl) ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={dataUrl}
            alt={fileName}
            className="max-h-28 rounded object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 py-4">
            <FileText size={32} className="text-primary" />
            <span className="text-[10px] text-muted-foreground">PDF</span>
          </div>
        )}
      </button>
      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{fileName}</span>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-primary"
          onClick={() => openFilePreview(dataUrl, fileName)}
          title="Preview"
        >
          <Eye size={13} />
        </button>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title="Remove"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

export default function OnboardingLegalPage() {
  const router = useRouter();
  const { draft, saveStep, markValidated } = useOnboarding();

  const form = useForm<OnboardingLegalInput>({
    resolver: zodResolver(onboardingLegalSchema),
    defaultValues: draft.legal ?? {
      registrationNumber: "",
      taxNumber: "",
      establishedDate: "",
      registrationCertificate: "",
      registrationCertName: "",
      ntnCertificate: "",
      ntnCertName: "",
    },
  });

  const { handleSubmit, setValue, watch } = form;

  const regCertName = watch("registrationCertName");
  const regCertData = watch("registrationCertificate");
  const ntnCertName = watch("ntnCertName");
  const ntnCertData = watch("ntnCertificate");

  const onBack = () => {
    saveStep("legal", form.getValues());
    router.push("/onboarding/identity");
  };

  const onSave = (data: OnboardingLegalInput) => {
    saveStep("legal", data);
    markValidated("legal");
    toast.success("Registration information saved");
  };

  const onNext = (data: OnboardingLegalInput) => {
    saveStep("legal", data);
    markValidated("legal");
    router.push("/onboarding/contact-address");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-lg">
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Registration Information
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Provide your organization&apos;s legal details. Enter &quot;N/A&quot; if
        not applicable.
      </p>

      <Form {...form}>
        <form className="space-y-5">
          <div className="grid grid-cols-2 gap-6">
            {/* ── Left: Fields + Upload Buttons ── */}
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. REG-12345 or N/A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">Registration Certificate</p>
                  <CertUploadBtn
                    hasFile={!!regCertName}
                    onUpload={(url, name) => {
                      setValue("registrationCertificate", url);
                      setValue("registrationCertName", name);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="taxNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax / NTN Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1234567-8 or N/A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">NTN Certificate</p>
                  <CertUploadBtn
                    hasFile={!!ntnCertName}
                    onUpload={(url, name) => {
                      setValue("ntnCertificate", url);
                      setValue("ntnCertName", name);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ── Right: Previews Side by Side ── */}
            <div className="flex gap-3">
              <CertPreview
                label="Registration Certificate"
                fileName={regCertName || undefined}
                dataUrl={regCertData || undefined}
                onRemove={() => {
                  setValue("registrationCertificate", "");
                  setValue("registrationCertName", "");
                }}
              />
              <CertPreview
                label="NTN Certificate"
                fileName={ntnCertName || undefined}
                dataUrl={ntnCertData || undefined}
                onRemove={() => {
                  setValue("ntnCertificate", "");
                  setValue("ntnCertName", "");
                }}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="establishedDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Established Date</FormLabel>
                <FormControl>
                  <Input type="date" max={new Date().toISOString().split("T")[0]} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

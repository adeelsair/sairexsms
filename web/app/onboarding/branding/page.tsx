"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Palette,
  Upload,
  X,
  ImageIcon,
  Loader2,
} from "lucide-react";

import { api } from "@/lib/api-client";
import {
  onboardingBrandingSchema,
  type OnboardingBrandingInput,
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

const ACCEPTED_IMAGE = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
];
const MAX_LOGO_SIZE = 5 * 1024 * 1024;

interface UploadedVariant {
  variant: string;
  url: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OnboardingBrandingPage() {
  const router = useRouter();
  const { draft, saveStep, markValidated } = useOnboarding();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(
    draft.branding?.logoUrl || null,
  );
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedVariants, setUploadedVariants] = useState<UploadedVariant[]>(
    [],
  );

  const form = useForm<OnboardingBrandingInput>({
    resolver: zodResolver(onboardingBrandingSchema),
    defaultValues: draft.branding ?? {
      logoUrl: "",
      websiteUrl: "",
    },
  });

  const { handleSubmit } = form;

  const handleFile = async (file: File) => {
    if (!ACCEPTED_IMAGE.includes(file.type)) {
      toast.error("Only PNG, JPG, WEBP, and SVG files are accepted");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error(
        `File too large. Maximum size is ${formatSize(MAX_LOGO_SIZE)}`,
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await api.upload<{
        version: number;
        logoUrl: string;
        variants: UploadedVariant[];
      }>("/api/media/logo/upload", formData);

      if (result.ok) {
        form.setValue("logoUrl", result.data.logoUrl);
        setUploadedVariants(result.data.variants);
        toast.success(
          `Logo uploaded (v${result.data.version}) — ${result.data.variants.length} variants generated`,
        );
      } else {
        toast.error(result.error || "Failed to upload logo");
        setPreview(null);
      }
    } catch {
      toast.error("Logo upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setPreview(null);
    setUploadedVariants([]);
    form.setValue("logoUrl", "");
    if (fileRef.current) fileRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onBack = () => {
    saveStep("branding", form.getValues());
    router.push("/onboarding/contact-address");
  };

  const onSave = (data: OnboardingBrandingInput) => {
    saveStep("branding", data);
    markValidated("branding");
    toast.success("Branding saved");
  };

  const onNext = (data: OnboardingBrandingInput) => {
    saveStep("branding", data);
    markValidated("branding");
    router.push("/onboarding/preview");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-lg">
      <div className="mb-6 text-center">
        <Palette className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h2 className="mb-1 text-xl font-semibold text-foreground">
          Branding
        </h2>
        <p className="text-sm text-muted-foreground">
          Add your organization&apos;s logo and website. You can skip this and
          add it later.
        </p>
      </div>

      <Form {...form}>
        <form className="space-y-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Logo Upload — left column */}
            <FormField
              control={form.control}
              name="logoUrl"
              render={() => (
                <FormItem>
                  <FormLabel>Organization Logo (Optional)</FormLabel>
                  <FormControl>
                    <div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFile(file);
                        }}
                      />

                      {preview ? (
                        <div className="space-y-3">
                          <div className="relative flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
                            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={preview}
                                alt="Logo preview"
                                className="h-full w-full object-contain"
                              />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-foreground">
                                Logo uploaded
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {uploadedVariants.length > 0
                                  ? `${uploadedVariants.length} variants (WEBP optimized)`
                                  : "You can replace or remove it"}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <SxButton
                                type="button"
                                sxVariant="outline"
                                size="sm"
                                icon={
                                  uploading ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Upload size={14} />
                                  )
                                }
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                              >
                                Replace
                              </SxButton>
                              <SxButton
                                type="button"
                                sxVariant="ghost"
                                size="sm"
                                icon={<X size={14} />}
                                onClick={removeLogo}
                                disabled={uploading}
                              >
                                Remove
                              </SxButton>
                            </div>
                          </div>

                          {uploadedVariants.length > 0 && (
                            <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-muted/20 p-3">
                              {uploadedVariants.map((v) => (
                                <div
                                  key={v.variant}
                                  className="flex flex-col items-center gap-1"
                                >
                                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-border bg-background">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={v.url}
                                      alt={`${v.variant} variant`}
                                      className="h-full w-full object-contain"
                                    />
                                  </div>
                                  <span className="text-[10px] font-medium uppercase text-muted-foreground">
                                    {v.variant}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 transition-colors ${
                            dragOver
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-muted/30"
                          }`}
                          onClick={() => fileRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                          }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={onDrop}
                        >
                          {uploading ? (
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                          ) : (
                            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                          )}
                          <p className="text-sm font-medium text-foreground">
                            {uploading
                              ? "Processing & optimizing..."
                              : "Click or drag & drop to upload"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG, WEBP, or SVG — Min 128×128 — Max 5 MB
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Auto-converted to WEBP with SM, MD, LG variants
                          </p>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Website — right column */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="websiteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://school.edu.pk" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-xs text-muted-foreground">
                You can update these anytime from your organization settings.
              </p>
            </div>
          </div>

          {/* Actions */}
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

"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowRight, Save } from "lucide-react";

import {
  onboardingIdentitySchema,
  ONBOARDING_ORGANIZATION_CATEGORY,
  ONBOARDING_ORGANIZATION_STRUCTURE,
  type OnboardingIdentityInput,
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OnboardingIdentityPage() {
  const router = useRouter();
  const { draft, saveStep, markValidated } = useOnboarding();

  const form = useForm<OnboardingIdentityInput>({
    resolver: zodResolver(onboardingIdentitySchema),
    defaultValues: draft.identity ?? {
      organizationName: "",
      displayName: "",
      organizationCategory: "SCHOOL",
      organizationStructure: "SINGLE",
    },
  });

  const { handleSubmit } = form;

  const onSave = (data: OnboardingIdentityInput) => {
    saveStep("identity", data);
    markValidated("identity");
    toast.success("Identity saved");
  };

  const onNext = (data: OnboardingIdentityInput) => {
    saveStep("identity", data);
    markValidated("identity");
    router.push("/onboarding/legal");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-lg">
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Organization Identity
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Provide your organization&apos;s basic information to get started.
      </p>

      <Form {...form}>
        <form className="space-y-5">
          <FormField
            control={form.control}
            name="organizationName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization Name (Legal)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. The City School (Pvt) Ltd" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. The City School" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="organizationCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ONBOARDING_ORGANIZATION_CATEGORY.map((c) => (
                        <SelectItem key={c} value={c}>
                          {humanize(c)}
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
              name="organizationStructure"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Structure</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select structure" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ONBOARDING_ORGANIZATION_STRUCTURE.map((s) => (
                        <SelectItem key={s} value={s}>
                          {humanize(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center justify-end gap-3 pt-2">
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
        </form>
      </Form>
    </div>
  );
}

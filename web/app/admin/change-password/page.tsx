"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { SxPageHeader, SxButton } from "@/components/sx";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

/* ── Types ─────────────────────────────────────────────────── */

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/* ── Page component ────────────────────────────────────────── */

export default function ChangePasswordPage() {
  const router = useRouter();

  const form = useForm<PasswordFormValues>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const {
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async (data: PasswordFormValues) => {
    if (data.newPassword !== data.confirmPassword) {
      form.setError("confirmPassword", {
        message: "New passwords do not match",
      });
      return;
    }

    if (data.newPassword.length < 8) {
      form.setError("newPassword", {
        message: "New password must be at least 8 characters",
      });
      return;
    }

    const result = await api.post<{ message: string }>(
      "/api/auth/change-password",
      {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      },
    );

    if (result.ok) {
      toast.success("Password changed successfully");
      reset();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <SxPageHeader
        title="Change Password"
        subtitle="Update your account password. You will need your current password."
      />

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="currentPassword"
            rules={{ required: "Current password is required" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="newPassword"
            rules={{
              required: "New password is required",
              minLength: { value: 8, message: "Minimum 8 characters" },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormDescription>Minimum 8 characters</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            rules={{ required: "Please confirm your new password" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-3 pt-2">
            <SxButton
              type="submit"
              sxVariant="primary"
              loading={isSubmitting}
              className="flex-1"
            >
              Update Password
            </SxButton>
            <SxButton
              type="button"
              sxVariant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              Cancel
            </SxButton>
          </div>
        </form>
      </Form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { KeyRound, Palette, Settings2, UserRound } from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { SxButton, SxDataTable, SxPageHeader, SxStatusBadge } from "@/components/sx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "../ThemeToggle";
import { ModeToggleButton } from "../ModeToggleButton";

interface OrganizationModeResponse {
  organizationId: string | null;
  mode: "SIMPLE" | "PRO";
  isSimple: boolean;
  isSuperAdmin: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [currentMode, setCurrentMode] = useState<"SIMPLE" | "PRO" | null>(null);
  const [modeLoading, setModeLoading] = useState(true);
  const isImpersonating = Boolean(
    (session?.user as { impersonation?: boolean } | undefined)?.impersonation,
  );

  useEffect(() => {
    let active = true;

    async function loadMode() {
      setModeLoading(true);
      const result = await api.get<OrganizationModeResponse>("/api/organizations/mode");
      if (!active) return;

      if (result.ok) {
        if (result.data.organizationId) {
          setCurrentMode(result.data.mode);
        }
        setModeLoading(false);
        return;
      }

      toast.error(result.error);
      setModeLoading(false);
    }

    void loadMode();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SxPageHeader
        title="Settings"
        subtitle="Manage your profile, security, and organization preferences."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-start justify-between gap-3 text-foreground">
              <span className="flex items-center gap-2">
                <UserRound className="mt-0.5 h-4 w-4" />
                Profile
              </span>
              <SxStatusBadge variant="info">Onboarding fields</SxStatusBadge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              View and edit the same details you entered during onboarding.
            </p>
            <SxButton asChild className="w-full" icon={<Settings2 size={16} />}>
              <Link href="/admin/settings/profile">Open Profile</Link>
            </SxButton>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-start justify-between gap-3 text-foreground">
              <span className="flex items-center gap-2">
                <KeyRound className="mt-0.5 h-4 w-4" />
                Account security
              </span>
              <SxStatusBadge variant="neutral">Password</SxStatusBadge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Update your password and keep your account secure.
            </p>
            <SxButton asChild sxVariant="outline" className="w-full">
              <Link href="/admin/change-password">Change password</Link>
            </SxButton>
          </CardContent>
        </Card>
      </div>

      {!isImpersonating ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-start justify-between gap-3 text-foreground">
                  <span className="flex items-center gap-2">
                    <Palette className="mt-0.5 h-4 w-4" />
                    Theme mode
                  </span>
                  <SxStatusBadge variant="neutral">UI</SxStatusBadge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Choose how the dashboard looks on this device.
                </p>
                <ThemeToggle />
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-start justify-between gap-3 text-foreground">
                  <span>Organization mode</span>
                  <SxStatusBadge variant={modeLoading ? "neutral" : currentMode ? "success" : "warning"}>
                    {modeLoading ? "Loading" : currentMode ?? "Unavailable"}
                  </SxStatusBadge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Switch between Simple and Pro features for your organization.
                </p>
                {currentMode ? (
                  <ModeToggleButton currentMode={currentMode} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Mode control is unavailable for this account.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

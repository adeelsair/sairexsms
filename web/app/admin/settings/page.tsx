"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { KeyRound, Palette } from "lucide-react";
import { SxButton, SxPageHeader } from "@/components/sx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "../ThemeToggle";
import { ModeToggleButton } from "../ModeToggleButton";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface OrganizationModeResponse {
  organizationId: string | null;
  mode: "SIMPLE" | "PRO";
  isSimple: boolean;
  isSuperAdmin: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [currentMode, setCurrentMode] = useState<"SIMPLE" | "PRO" | null>(null);
  const isImpersonating = Boolean(
    (session?.user as { impersonation?: boolean } | undefined)?.impersonation,
  );

  useEffect(() => {
    let active = true;

    async function loadMode() {
      const result = await api.get<OrganizationModeResponse>("/api/organizations/mode");
      if (!active) return;

      if (result.ok) {
        if (result.data.organizationId) {
          setCurrentMode(result.data.mode);
        }
        return;
      }

      toast.error(result.error);
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
        subtitle="Manage your account preferences and display mode."
      />

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <KeyRound className="h-4 w-4" />
            Account security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SxButton asChild sxVariant="outline">
            <Link href="/admin/change-password">Change Password</Link>
          </SxButton>
        </CardContent>
      </Card>

      {!isImpersonating ? (
        <>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Palette className="h-4 w-4" />
                Theme mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ThemeToggle />
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Organization mode</CardTitle>
            </CardHeader>
            <CardContent>
              {currentMode ? (
                <ModeToggleButton currentMode={currentMode} />
              ) : (
                <p className="text-sm text-muted-foreground">Mode control is unavailable for this account.</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

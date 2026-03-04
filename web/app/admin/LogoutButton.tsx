"use client";

import { LogOut } from "lucide-react";
import { SxButton } from "@/components/sx";
import { api } from "@/lib/api-client";

export default function LogoutButton() {
  const handleLogout = async () => {
    await api.post<{ ok: boolean }>("/api/auth/local-logout");
    window.location.href = "/login";
  };

  return (
    <SxButton
      onClick={() => {
        void handleLogout();
      }}
      sxVariant="ghost"
      className="w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-normal text-sidebar-foreground/80 transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:ring-destructive/40"
    >
      <LogOut size={18} />
      Logout
    </SxButton>
  );
}

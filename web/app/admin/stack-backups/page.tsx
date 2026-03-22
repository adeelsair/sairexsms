import { redirect } from "next/navigation";

/** @deprecated Use /admin/backups */
export default function LegacyStackBackupsRedirect() {
  redirect("/admin/backups");
}

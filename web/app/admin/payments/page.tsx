import { redirect } from "next/navigation";

export default function PaymentsLegacyPage() {
  redirect("/admin/payment-engine?tab=manual-collection");
}


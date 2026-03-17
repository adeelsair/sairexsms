import { redirect } from "next/navigation";

export default function PaymentsLegacyPage() {
  redirect("/admin/payment-gateway?tab=manual-collection");
}


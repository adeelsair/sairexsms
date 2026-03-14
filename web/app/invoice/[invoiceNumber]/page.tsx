import { redirect } from "next/navigation";

export default async function PublicInvoiceAliasPage({
  params,
}: {
  params: Promise<{ invoiceNumber: string }>;
}) {
  const { invoiceNumber } = await params;
  redirect(`/pay/${encodeURIComponent(invoiceNumber)}`);
}

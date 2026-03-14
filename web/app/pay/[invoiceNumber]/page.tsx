"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type PaymentProvider = "1BILL" | "EASYPAISA" | "JAZZCASH" | "CARD";

interface PublicInvoicePayload {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  billId: string | null;
  paymentUrl: string;
  qrDataUrl: string;
  barcodeDataUrl: string | null;
}

interface InvoiceStatusPayload {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: number;
  paidAt: string | null;
  providerRef: string | null;
}

interface ProviderInitPayload {
  invoiceNumber: string;
  provider: PaymentProvider;
  billId: string;
}

const PROVIDERS: PaymentProvider[] = ["1BILL", "EASYPAISA", "JAZZCASH", "CARD"];

export default function PublicPaymentPage() {
  const params = useParams<{ invoiceNumber: string }>();
  const invoiceNumber = useMemo(
    () => decodeURIComponent(params?.invoiceNumber ?? ""),
    [params?.invoiceNumber],
  );
  const [invoice, setInvoice] = useState<PublicInvoicePayload | null>(null);
  const [status, setStatus] = useState<InvoiceStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerLoading, setProviderLoading] = useState<PaymentProvider | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (!invoiceNumber) return;
    const result = await api.get<PublicInvoicePayload>(
      `/payments/public/invoice/${encodeURIComponent(invoiceNumber)}`,
    );
    if (result.ok) {
      setInvoice(result.data);
      return;
    }
    toast.error(result.error);
  }, [invoiceNumber]);

  const fetchStatus = useCallback(async () => {
    if (!invoiceNumber) return;
    const result = await api.get<InvoiceStatusPayload>(
      `/payments/public/invoice/${encodeURIComponent(invoiceNumber)}/status`,
    );
    if (result.ok) {
      setStatus(result.data);
      return;
    }
    toast.error(result.error);
  }, [invoiceNumber]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await Promise.all([fetchInvoice(), fetchStatus()]);
      if (mounted) {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchInvoice, fetchStatus]);

  useEffect(() => {
    if (!invoiceNumber) return;
    const timer = setInterval(() => {
      void fetchStatus();
    }, 5000);
    return () => clearInterval(timer);
  }, [invoiceNumber, fetchStatus]);

  const initProvider = async (provider: PaymentProvider) => {
    if (!invoiceNumber) return;
    setProviderLoading(provider);
    const result = await api.post<ProviderInitPayload>(
      `/payments/public/invoice/${encodeURIComponent(invoiceNumber)}/provider/${provider}`,
    );

    if (result.ok) {
      toast.success(`${provider} payment initialized`);
      await Promise.all([fetchInvoice(), fetchStatus()]);
    } else {
      toast.error(result.error);
    }
    setProviderLoading(null);
  };

  if (loading) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">Loading invoice...</div>;
  }

  if (!invoice) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Invoice not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This payment link is invalid or has expired.
        </p>
      </div>
    );
  }

  const paid = status?.status === "PAID";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Student Fee Invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invoice: {invoice.invoiceNumber}
        </p>
        <div className="mt-4 grid gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Amount:</span>{" "}
            <span className="font-semibold">
              {invoice.currency} {invoice.amount.toLocaleString()}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Due Date:</span>{" "}
            {new Date(invoice.dueDate).toLocaleDateString("en-PK")}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span>{" "}
            <span className={paid ? "text-success" : "text-warning"}>
              {status?.status ?? invoice.status}
            </span>
          </p>
          {!!(status?.paidAt ?? null) && (
            <p>
              <span className="text-muted-foreground">Paid At:</span>{" "}
              {new Date(String(status?.paidAt)).toLocaleString("en-PK")}
            </p>
          )}
          {!!(invoice.billId ?? status?.providerRef) && (
            <p>
              <span className="text-muted-foreground">1Bill ID:</span>{" "}
              <span className="font-mono">{invoice.billId ?? status?.providerRef}</span>
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Pay Now</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a payment method. Status auto-refreshes every 5 seconds.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROVIDERS.map((provider) => (
            <Button
              key={provider}
              onClick={() => void initProvider(provider)}
              disabled={!!providerLoading || paid}
              variant={provider === "1BILL" ? "default" : "outline"}
            >
              {providerLoading === provider ? "Initializing..." : `Pay via ${provider}`}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold">Scan QR</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Scan to open this invoice payment page on another device.
          </p>
          <img src={invoice.qrDataUrl} alt="Invoice QR" className="mt-4 h-48 w-48 rounded border border-border" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold">1Bill Barcode</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Use this bill ID in your banking app / wallet.
          </p>
          {invoice.barcodeDataUrl ? (
            <img src={invoice.barcodeDataUrl} alt="1Bill barcode" className="mt-4 w-full rounded border border-border bg-background p-2" />
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Barcode is available after provider bill initialization.
            </p>
          )}
        </div>
      </div>

      {paid && status?.id ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold">Payment Completed</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your payment is confirmed. You can view or download receipt.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`/payments/receipt/${status.id}`} target="_blank" rel="noreferrer">
              <Button variant="outline">View Receipt JSON</Button>
            </a>
            <a href={`/payments/receipt/${status.id}/pdf`} target="_blank" rel="noreferrer">
              <Button>Download Receipt PDF</Button>
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

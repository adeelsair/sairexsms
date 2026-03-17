"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { RefreshCw, ShieldCheck } from "lucide-react";

import { api } from "@/lib/api-client";
import {
  providerCheckSchema,
  type ProviderCheckInput,
} from "@/lib/validations/payment-gateway";
import {
  SxPageHeader,
  SxButton,
  SxDataTable,
  SxStatusBadge,
  SxFormSection,
  SxAmount,
  type SxColumn,
} from "@/components/sx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualCollectionTab } from "./manual-collection-tab";

interface AnalyticsPayload {
  totalRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  lateInvoices: number;
  averagePaymentTimeHours: number;
}

interface QueueStatsPayload {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

interface AlertRow extends Record<string, unknown> {
  event: string;
  count: number;
}

interface InvoiceRow extends Record<string, unknown> {
  id: string;
  invoiceNumber: string;
  schoolId: string;
  amount: number;
  amountPaid: number;
  lateFee: number;
  status: string;
  dueDate: string;
}

interface PaymentRow extends Record<string, unknown> {
  id: string;
  invoiceId: string;
  provider: string;
  transactionId: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface RefundRow extends Record<string, unknown> {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface ReconciliationPayload {
  totalPayments: number;
  paidInvoices: number;
  events: Array<{ event: string; count: number }>;
}

interface ProviderCheckResponse {
  schoolId: string;
  provider: string;
  mode: "AUTO" | "MANUAL";
  overallStatus: "PASS" | "WARN" | "FAIL";
  checks: Array<{ key: string; status: "PASS" | "WARN" | "FAIL"; message: string }>;
  checkedAt: string;
}

const alertColumns: SxColumn<AlertRow>[] = [
  { key: "event", header: "Event", render: (row) => <span className="font-medium">{row.event}</span> },
  { key: "count", header: "Count", numeric: true, mono: true },
];

const invoiceColumns: SxColumn<InvoiceRow>[] = [
  { key: "invoiceNumber", header: "Invoice", mono: true },
  { key: "schoolId", header: "School", mono: true },
  { key: "amount", header: "Total", render: (row) => <SxAmount value={row.amount} /> },
  { key: "amountPaid", header: "Paid", render: (row) => <SxAmount value={row.amountPaid} /> },
  { key: "lateFee", header: "Late Fee", render: (row) => <SxAmount value={row.lateFee} /> },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge variant={row.status === "PAID" ? "success" : row.status === "PARTIAL" ? "warning" : "info"}>
        {row.status}
      </SxStatusBadge>
    ),
  },
];

const paymentColumns: SxColumn<PaymentRow>[] = [
  { key: "transactionId", header: "Transaction", mono: true },
  { key: "provider", header: "Provider", mono: true },
  { key: "amount", header: "Amount", render: (row) => <SxAmount value={row.amount} /> },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge variant={row.status === "PAID" ? "success" : "info"}>
        {row.status}
      </SxStatusBadge>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (row) => <span className="text-muted-foreground">{new Date(row.createdAt).toLocaleString("en-PK")}</span>,
  },
];

const refundColumns: SxColumn<RefundRow>[] = [
  { key: "paymentId", header: "Payment ID", mono: true },
  { key: "amount", header: "Amount", render: (row) => <SxAmount value={row.amount} /> },
  { key: "reason", header: "Reason" },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge variant={row.status === "PROCESSED" ? "success" : "warning"}>
        {row.status}
      </SxStatusBadge>
    ),
  },
];

function statusVariant(value: "PASS" | "WARN" | "FAIL") {
  if (value === "PASS") return "success";
  if (value === "WARN") return "warning";
  return "destructive";
}

export default function PaymentGatewayPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStatsPayload | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationPayload | null>(null);
  const [providerReport, setProviderReport] = useState<ProviderCheckResponse | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const hasShownApiUnavailableToast = useRef(false);

  const form = useForm<ProviderCheckInput>({
    resolver: zodResolver(providerCheckSchema),
    defaultValues: {
      schoolId: "school1",
      provider: "1BILL",
      mode: "AUTO",
      bankName: "",
      accountTitle: "",
      accountNumber: "",
      providerMerchantId: "",
    },
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "overview" || tab === "provider-checks" || tab === "operations" || tab === "manual-collection") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setApiUnavailable(false);
    const [
      analyticsRes,
      queueRes,
      alertsRes,
      invoicesRes,
      paymentsRes,
      refundsRes,
      reconciliationRes,
    ] = await Promise.all([
      api.get<AnalyticsPayload>("/payments/analytics"),
      api.get<QueueStatsPayload>("/payments/queue-stats"),
      api.get<{ alerts: AlertRow[] }>("/payments/alerts?hours=24"),
      api.get<InvoiceRow[]>("/payments/invoices"),
      api.get<PaymentRow[]>("/payments/payments"),
      api.get<RefundRow[]>("/payments/refunds"),
      api.get<ReconciliationPayload>("/payments/reconciliation"),
    ]);

    const responses = [
      analyticsRes,
      queueRes,
      alertsRes,
      invoicesRes,
      paymentsRes,
      refundsRes,
      reconciliationRes,
    ];
    const firstError = responses.find((entry) => !entry.ok);
    const isConnectionError =
      firstError &&
      !firstError.ok &&
      (firstError.status === 0 ||
        firstError.status === 404 ||
        /ECONNREFUSED|fetch failed|Network error/i.test(firstError.error ?? ""));

    if (isConnectionError) {
      setApiUnavailable(true);
      if (!hasShownApiUnavailableToast.current) {
        hasShownApiUnavailableToast.current = true;
        toast.warning(
          "Payment API is not running. Start it from the repo root: npm run dev:payment-api — Manual Collection still works.",
          { duration: 8000 },
        );
      }
    } else if (firstError && !firstError.ok) {
      toast.error(firstError.error);
    }

    if (analyticsRes.ok) setAnalytics(analyticsRes.data);
    if (queueRes.ok) setQueueStats(queueRes.data);
    if (alertsRes.ok) setAlerts(alertsRes.data.alerts ?? []);
    if (invoicesRes.ok) setInvoices(invoicesRes.data);
    if (paymentsRes.ok) setPayments(paymentsRes.data);
    if (refundsRes.ok) setRefunds(refundsRes.data);
    if (reconciliationRes.ok) setReconciliation(reconciliationRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const manualMode = form.watch("mode") === "MANUAL";

  const runProviderCheck = async (values: ProviderCheckInput) => {
    const result = await api.post<ProviderCheckResponse>(
      `/payments/provider-check/${encodeURIComponent(values.provider)}`,
      values,
    );

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setProviderReport(result.data);
    toast.success("Provider check completed");
  };

  const healthBadge = useMemo(() => {
    if (!queueStats) return null;
    if (queueStats.failed > 0) return { label: "Attention", variant: "warning" as const };
    if (queueStats.active > 0 || queueStats.waiting > 0) return { label: "Processing", variant: "info" as const };
    return { label: "Healthy", variant: "success" as const };
  }, [queueStats]);

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Payment Gateway"
        subtitle="Operational dashboard for payment rails, queue health, and provider diagnostics."
        actions={
          <div className="flex items-center gap-2">
            {healthBadge ? (
              <SxStatusBadge variant={healthBadge.variant}>{healthBadge.label}</SxStatusBadge>
            ) : null}
            <SxButton sxVariant="outline" onClick={() => void fetchDashboard()} loading={loading}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </SxButton>
          </div>
        }
      />

      {apiUnavailable && (
        <div className="rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          <strong>Payment API not running.</strong> Overview, Provider Checks, and Operations need the API. Manual Collection works without it. From repo root run: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run dev:payment-api</code>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="provider-checks">Provider Checks</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="manual-collection">Manual Collection</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="mt-1 text-2xl font-semibold">
                <SxAmount value={analytics?.totalRevenue ?? 0} />
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Invoice Health</p>
              <p className="mt-1 text-sm">
                Paid: <strong>{analytics?.paidInvoices ?? 0}</strong> / Pending: <strong>{analytics?.pendingInvoices ?? 0}</strong>
              </p>
              <p className="text-sm text-muted-foreground">Late: {analytics?.lateInvoices ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Queue</p>
              <p className="mt-1 text-sm">Waiting: <strong>{queueStats?.waiting ?? 0}</strong></p>
              <p className="text-sm">Active: <strong>{queueStats?.active ?? 0}</strong> / Failed: <strong>{queueStats?.failed ?? 0}</strong></p>
            </div>
          </div>

          <SxDataTable
            columns={alertColumns}
            data={alerts}
            loading={loading}
            emptyMessage="No alerting events in selected window."
          />
        </TabsContent>

        <TabsContent value="provider-checks" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(runProviderCheck)} className="space-y-6">
                <SxFormSection title="Provider Test Runner" description="Auto or manual checks for bank and wallet rails." columns={3}>
                  <FormField
                    control={form.control}
                    name="schoolId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School ID</FormLabel>
                        <FormControl>
                          <Input placeholder="school1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provider</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="BANK">Bank Account</SelectItem>
                            <SelectItem value="1BILL">1Bill</SelectItem>
                            <SelectItem value="EASYPAISA">Easypaisa</SelectItem>
                            <SelectItem value="JAZZCASH">JazzCash</SelectItem>
                            <SelectItem value="CARD">Card</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Check Mode</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="AUTO">Auto Check</SelectItem>
                            <SelectItem value="MANUAL">Manual Check + Save Config</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SxFormSection>

                {manualMode ? (
                  <SxFormSection title="Manual Configuration" description="Saved before manual provider validation." columns={2}>
                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name</FormLabel>
                          <FormControl>
                            <Input placeholder="HBL / Meezan / UBL" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Title</FormLabel>
                          <FormControl>
                            <Input placeholder="School account title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Account number / IBAN" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="providerMerchantId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Provider Merchant ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Merchant profile ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SxFormSection>
                ) : null}

                <div className="flex justify-end">
                  <SxButton type="submit" sxVariant="primary" loading={form.formState.isSubmitting}>
                    <ShieldCheck className="mr-2 size-4" />
                    Run Provider Check
                  </SxButton>
                </div>
              </form>
            </Form>
          </div>

          {providerReport ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Last Check Result</h3>
                <SxStatusBadge variant={statusVariant(providerReport.overallStatus)}>
                  {providerReport.overallStatus}
                </SxStatusBadge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {providerReport.provider} / {providerReport.mode} / {new Date(providerReport.checkedAt).toLocaleString("en-PK")}
              </p>
              <div className="mt-3 space-y-2">
                {providerReport.checks.map((check) => (
                  <div key={check.key} className="flex items-center justify-between rounded-lg border border-border bg-background p-2">
                    <span className="text-sm">{check.message}</span>
                    <SxStatusBadge variant={statusVariant(check.status)}>{check.status}</SxStatusBadge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Reconciliation Summary</p>
              <p className="mt-1 text-sm">Payments: <strong>{reconciliation?.totalPayments ?? 0}</strong></p>
              <p className="text-sm">Paid invoices: <strong>{reconciliation?.paidInvoices ?? 0}</strong></p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Average Payment Time</p>
              <p className="mt-1 text-2xl font-semibold">{analytics?.averagePaymentTimeHours ?? 0}h</p>
            </div>
          </div>

          <SxDataTable columns={invoiceColumns} data={invoices} loading={loading} emptyMessage="No invoices available." />
          <SxDataTable columns={paymentColumns} data={payments} loading={loading} emptyMessage="No payments available." />
          <SxDataTable columns={refundColumns} data={refunds} loading={loading} emptyMessage="No refunds available." />
        </TabsContent>

        <TabsContent value="manual-collection" className="space-y-4">
          <ManualCollectionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

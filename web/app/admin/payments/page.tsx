"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Search } from "lucide-react";

import { api } from "@/lib/api-client";
import { paymentEntrySchema, type PaymentEntryInput } from "@/lib/validations/payment-entry";
import {
  SxPageHeader,
  SxButton,
  SxDataTable,
  SxStatusBadge,
  SxAmount,
  SxFormSection,
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

interface StudentSearchRow extends Record<string, unknown> {
  id: number;
  fullName: string;
  admissionNo: string;
  grade: string;
  campusName: string;
}

interface StudentFinancialSummary extends Record<string, unknown> {
  studentId: number;
  fullName: string;
  admissionNo: string;
  campusName: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

interface OutstandingChallan extends Record<string, unknown> {
  id: number;
  challanNo: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: "UNPAID" | "PARTIALLY_PAID";
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

const challanColumns: SxColumn<OutstandingChallan>[] = [
  {
    key: "challanNo",
    header: "Challan ID",
    mono: true,
    render: (row) => <span className="font-data text-xs">{row.challanNo}</span>,
  },
  {
    key: "dueDate",
    header: "Due Date",
    render: (row) => (
      <span className="text-muted-foreground">
        {new Date(row.dueDate).toLocaleDateString("en-PK")}
      </span>
    ),
  },
  {
    key: "totalAmount",
    header: "Total",
    numeric: true,
    mono: true,
    render: (row) => <SxAmount value={row.totalAmount} />,
  },
  {
    key: "paidAmount",
    header: "Paid",
    numeric: true,
    mono: true,
    render: (row) => <SxAmount value={row.paidAmount} />,
  },
  {
    key: "balance",
    header: "Balance",
    numeric: true,
    mono: true,
    render: (row) => <SxAmount value={row.balance} />,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge
        variant={
          new Date(row.dueDate) < new Date()
            ? "destructive"
            : row.status === "UNPAID"
              ? "warning"
              : "info"
        }
      >
        {new Date(row.dueDate) < new Date()
          ? "OVERDUE"
          : row.status === "UNPAID"
            ? "PENDING"
            : "PARTIAL"}
      </SxStatusBadge>
    ),
  },
];

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [students, setStudents] = useState<StudentSearchRow[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const [summary, setSummary] = useState<StudentFinancialSummary | null>(null);
  const [challans, setChallans] = useState<OutstandingChallan[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingChallans, setLoadingChallans] = useState(false);

  const form = useForm<PaymentEntryInput>({
    resolver: zodResolver(paymentEntrySchema),
    defaultValues: {
      challanId: "",
      amount: "",
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "OTC",
      referenceNumber: "",
      notes: "",
    },
  });

  const selectedChallan = useMemo(
    () => challans.find((challan) => String(challan.id) === form.watch("challanId")) ?? null,
    [challans, form],
  );

  const fetchStudents = useCallback(async (q: string) => {
    const query = q.trim();
    if (query.length < 2) {
      setStudents([]);
      return;
    }

    setSearching(true);
    const result = await api.get<ApiEnvelope<StudentSearchRow[]>>(
      `/api/finance/payments?view=students&search=${encodeURIComponent(query)}&limit=20`,
    );

    if (!result.ok) {
      toast.error(result.error);
      setSearching(false);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to search students");
      setSearching(false);
      return;
    }

    setStudents(result.data.data);
    setSearching(false);
  }, []);

  const fetchStudentContext = useCallback(async (studentId: string) => {
    if (!studentId) {
      setSummary(null);
      setChallans([]);
      return;
    }

    setLoadingSummary(true);
    setLoadingChallans(true);

    const [summaryResult, challansResult] = await Promise.all([
      api.get<ApiEnvelope<StudentFinancialSummary>>(
        `/api/finance/payments?view=summary&studentId=${studentId}`,
      ),
      api.get<ApiEnvelope<OutstandingChallan[]>>(
        `/api/finance/payments?view=challans&studentId=${studentId}`,
      ),
    ]);

    if (summaryResult.ok && summaryResult.data.ok) {
      setSummary(summaryResult.data.data);
    } else {
      toast.error(summaryResult.ok ? (summaryResult.data.error ?? "Failed to load summary") : summaryResult.error);
      setSummary(null);
    }

    if (challansResult.ok && challansResult.data.ok) {
      setChallans(challansResult.data.data);
    } else {
      toast.error(challansResult.ok ? (challansResult.data.error ?? "Failed to load challans") : challansResult.error);
      setChallans([]);
    }

    setLoadingSummary(false);
    setLoadingChallans(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchStudents]);

  useEffect(() => {
    form.resetField("challanId");
    form.resetField("amount");
    fetchStudentContext(selectedStudentId);
  }, [selectedStudentId, fetchStudentContext, form]);

  const submitPayment = async (values: PaymentEntryInput) => {
    if (!selectedStudentId) {
      toast.error("Select a student first");
      return;
    }

    const selected = challans.find((challan) => String(challan.id) === values.challanId);
    if (!selected) {
      toast.error("Select a valid challan");
      return;
    }

    const amount = Number(values.amount);
    if (amount > selected.balance) {
      form.setError("amount", { message: "Amount cannot exceed challan balance" });
      return;
    }

    const result = await api.post<ApiEnvelope<{
      paymentRecordId: string;
      challanId: number;
      challanStatus: string;
      newPaidAmount: number;
      ledgerEntryId: string;
    }>>("/api/finance/payments", {
      challanId: Number(values.challanId),
      amount,
      paymentDate: values.paymentDate,
      paymentMethod: values.paymentMethod,
      referenceNumber: values.referenceNumber || undefined,
      notes: values.notes || undefined,
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (!result.data.ok) {
      toast.error(result.data.error ?? "Payment reconciliation failed");
      return;
    }

    toast.success("Payment recorded and reconciled");
    form.reset({
      challanId: "",
      amount: "",
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "OTC",
      referenceNumber: "",
      notes: "",
    });
    await fetchStudentContext(selectedStudentId);
  };

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Manual Payments"
        subtitle="Record payment and reconcile challans with ledger-safe flow"
      />

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Student Selector
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_320px]">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by student name or admission number"
              className="pl-9"
            />
          </div>
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger>
              <SelectValue placeholder={searching ? "Searching..." : "Select student"} />
            </SelectTrigger>
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.id} value={String(student.id)}>
                  {student.fullName} ({student.admissionNo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {summary && (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">Student</p>
            <p className="mt-1 text-sm font-medium">{summary.fullName}</p>
            <p className="text-xs text-muted">{summary.admissionNo}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">Total Debit</p>
            <p className="mt-1 text-xl font-semibold"><SxAmount value={summary.totalDebit} /></p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">Total Credit</p>
            <p className="mt-1 text-xl font-semibold"><SxAmount value={summary.totalCredit} /></p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">Current Balance</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                summary.balance > 0 ? "text-[var(--sx-danger)]" : "text-[var(--sx-success)]"
              }`}
            >
              <SxAmount value={summary.balance} />
            </p>
          </div>
        </div>
      )}

      <SxDataTable
        columns={challanColumns}
        data={challans}
        loading={loadingChallans || loadingSummary}
        emptyMessage="Select a student to load outstanding challans."
      />

      {selectedStudentId && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-4 text-sm font-semibold text-muted">Record Payment</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submitPayment)} className="space-y-6">
              <SxFormSection columns={2}>
                <FormField
                  control={form.control}
                  name="challanId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Challan</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          const found = challans.find((challan) => String(challan.id) === value);
                          form.setValue("amount", found ? String(found.balance) : "");
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select challan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {challans.map((challan) => (
                            <SelectItem key={challan.id} value={String(challan.id)}>
                              {challan.challanNo} - Balance {challan.balance.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      {selectedChallan && (
                        <p className="text-xs text-muted">
                          Remaining balance: {selectedChallan.balance.toFixed(2)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SxFormSection>

              <SxFormSection columns={2}>
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="OTC">Cash</SelectItem>
                          <SelectItem value="BANK_TRANSFER">Bank</SelectItem>
                          <SelectItem value="OTHER">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SxFormSection>

              <SxFormSection columns={2}>
                <FormField
                  control={form.control}
                  name="referenceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Number (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Txn / voucher reference" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Notes for audit trail" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SxFormSection>

              <div className="flex justify-end">
                <SxButton
                  type="submit"
                  sxVariant="primary"
                  className="h-11 text-base font-medium"
                  loading={form.formState.isSubmitting}
                >
                  Record Payment
                </SxButton>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}


"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Zap, Printer } from "lucide-react";
import Link from "next/link";

import { api } from "@/lib/api-client";
import {
  SxPageHeader,
  SxButton,
  SxStatusBadge,
  SxAmount,
  SxDataTable,
  type SxColumn,
} from "@/components/sx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ── Types ─────────────────────────────────────────────────── */

interface Org {
  id: string;
  organizationName: string;
}

interface CampusRef {
  id: number;
  name: string;
  organizationId: string;
}

interface FeeHead {
  id: number;
  name: string;
  type: string;
  organizationId: string;
  organization?: { id: string; organizationName: string };
}

interface FeeStructure {
  id: number;
  name: string;
  amount: string | number;
  frequency: string;
  applicableGrade: string | null;
  organizationId: string;
  campusId: number;
  feeHead?: { id: number; name: string };
  campus?: { id: number; name: string };
}

interface Challan {
  id: number;
  challanNo: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string | number;
  paidAmount: string | number;
  status: string;
  paymentMethod: string | null;
  student: { id: number; fullName: string };
  campus: { id: number; name: string };
}

type ActiveTab = "HEADS" | "STRUCTURES" | "CHALLANS";

/* ── Form types ────────────────────────────────────────────── */

interface HeadFormValues {
  name: string;
  type: string;
  organizationId: string;
}

interface StructureFormValues {
  name: string;
  amount: string;
  frequency: string;
  applicableGrade: string;
  organizationId: string;
  campusId: string;
  feeHeadId: string;
}

interface GeneratorFormValues {
  organizationId: string;
  campusId: string;
  targetGrade: string;
  billingMonth: string;
  dueDate: string;
}

interface PaymentFormValues {
  paymentMethod: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FREQUENCIES = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "BI_MONTHLY", label: "Bi-Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-Yearly" },
  { value: "ANNUALLY", label: "Annually" },
  { value: "ONCE", label: "Once" },
];

/* ── Column definitions ────────────────────────────────────── */

const headColumns: SxColumn<FeeHead>[] = [
  {
    key: "name",
    header: "Category Name",
    render: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    key: "type",
    header: "Type",
    render: (row) => (
      <SxStatusBadge variant={row.type === "RECURRING" ? "info" : "warning"}>
        {row.type}
      </SxStatusBadge>
    ),
  },
  {
    key: "organization",
    header: "Organization",
    render: (row) => (
      <span className="text-muted-foreground">
        {row.organization?.organizationName}
      </span>
    ),
  },
];

const structureColumns: SxColumn<FeeStructure>[] = [
  {
    key: "name",
    header: "Rule Name",
    render: (row) => (
      <div>
        <div className="font-medium">{row.name}</div>
        {row.applicableGrade && (
          <div className="text-xs text-muted-foreground">
            Grade: {row.applicableGrade}
          </div>
        )}
      </div>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    numeric: true,
    mono: true,
    render: (row) => (
      <div>
        <SxAmount value={Number(row.amount)} />
        <div className="text-xs text-muted-foreground">{row.frequency}</div>
      </div>
    ),
  },
  {
    key: "feeHead",
    header: "Category",
    render: (row) => row.feeHead?.name ?? "—",
  },
  {
    key: "campus",
    header: "Campus",
    render: (row) => (
      <span className="text-muted-foreground">{row.campus?.name}</span>
    ),
  },
];

/* ── Page component ────────────────────────────────────────── */

export default function FinancePage() {
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<ActiveTab>("HEADS");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [campuses, setCampuses] = useState<CampusRef[]>([]);
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);

  /* ── Sync tab from URL ─────────────────────────────────── */

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "heads") setActiveTab("HEADS");
    if (tab === "structures") setActiveTab("STRUCTURES");
    if (tab === "challans") setActiveTab("CHALLANS");
  }, [searchParams]);

  /* ── Fetch data ────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [o, c, h, s, ch] = await Promise.all([
      api.get<Org[]>("/api/organizations"),
      api.get<CampusRef[]>("/api/campuses"),
      api.get<FeeHead[]>("/api/finance/heads"),
      api.get<FeeStructure[]>("/api/finance/structures"),
      api.get<Challan[]>("/api/finance/challans"),
    ]);
    if (o.ok) setOrgs(o.data);
    if (c.ok) setCampuses(c.data);
    if (h.ok) setHeads(h.data);
    if (s.ok) setStructures(s.data);
    if (ch.ok) setChallans(ch.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Challan columns (depends on state) ────────────────── */

  const challanColumns: SxColumn<Challan>[] = useMemo(
    () => [
      {
        key: "challanNo",
        header: "Challan No.",
        mono: true,
        render: (row) => (
          <span className="font-data text-xs font-bold text-primary">
            {row.challanNo}
          </span>
        ),
      },
      {
        key: "student",
        header: "Student",
        render: (row) => (
          <div>
            <div className="font-medium">{row.student?.fullName}</div>
            <div className="text-xs text-muted-foreground">
              {row.campus?.name}
            </div>
          </div>
        ),
      },
      {
        key: "dueDate",
        header: "Due Date",
        render: (row) => (
          <span className="text-muted-foreground">
            {new Date(row.dueDate).toLocaleDateString()}
          </span>
        ),
      },
      {
        key: "totalAmount",
        header: "Amount",
        numeric: true,
        mono: true,
        render: (row) => <SxAmount value={Number(row.totalAmount)} />,
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <SxStatusBadge feeStatus={row.status} />,
      },
      {
        key: "actions",
        header: "",
        render: (row) => (
          <div className="flex items-center justify-end gap-2">
            <SxButton sxVariant="ghost" size="sm" asChild>
              <Link href={`/admin/finance/challans/${row.id}/print`}>
                <Printer size={14} />
                Print
              </Link>
            </SxButton>
            {row.status !== "PAID" ? (
              <SxButton
                sxVariant="primary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedChallan(row);
                  setIsPaymentOpen(true);
                }}
              >
                Receive
              </SxButton>
            ) : (
              <span className="text-xs italic text-muted-foreground">
                Cleared
              </span>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  /* ── Head form ─────────────────────────────────────────── */

  const headForm = useForm<HeadFormValues>({
    defaultValues: { name: "", type: "RECURRING", organizationId: "" },
  });

  const onHeadSubmit = async (data: HeadFormValues) => {
    const result = await api.post<FeeHead>("/api/finance/heads", data);
    if (result.ok) {
      toast.success("Fee category created");
      setIsCreateOpen(false);
      headForm.reset();
      fetchData();
    } else {
      toast.error(result.error);
    }
  };

  /* ── Structure form ────────────────────────────────────── */

  const structForm = useForm<StructureFormValues>({
    defaultValues: {
      name: "",
      amount: "",
      frequency: "MONTHLY",
      applicableGrade: "",
      organizationId: "",
      campusId: "",
      feeHeadId: "",
    },
  });

  const structOrgId = structForm.watch("organizationId");

  const structCampusList = useMemo(
    () =>
      structOrgId
        ? campuses.filter((c) => c.organizationId === structOrgId)
        : [],
    [campuses, structOrgId],
  );

  const structHeadList = useMemo(
    () =>
      structOrgId
        ? heads.filter((h) => h.organizationId === structOrgId)
        : [],
    [heads, structOrgId],
  );

  const onStructSubmit = async (data: StructureFormValues) => {
    const result = await api.post<FeeStructure>(
      "/api/finance/structures",
      data,
    );
    if (result.ok) {
      toast.success("Pricing rule created");
      setIsCreateOpen(false);
      structForm.reset();
      fetchData();
    } else {
      toast.error(result.error);
    }
  };

  /* ── Generator form ────────────────────────────────────── */

  const genForm = useForm<GeneratorFormValues>({
    defaultValues: {
      organizationId: "",
      campusId: "",
      targetGrade: "",
      billingMonth: "March",
      dueDate: "",
    },
  });

  const genOrgId = genForm.watch("organizationId");

  const genCampusList = useMemo(
    () =>
      genOrgId ? campuses.filter((c) => c.organizationId === genOrgId) : [],
    [campuses, genOrgId],
  );

  const onGenerateSubmit = async (data: GeneratorFormValues) => {
    const result = await api.post<{ message: string }>(
      "/api/finance/challans",
      data,
    );
    if (result.ok) {
      toast.success(result.data.message);
      setIsCreateOpen(false);
      genForm.reset();
      fetchData();
    } else {
      toast.error(result.error);
    }
  };

  /* ── Payment form ──────────────────────────────────────── */

  const payForm = useForm<PaymentFormValues>({
    defaultValues: { paymentMethod: "CASH" },
  });

  const onPaymentSubmit = async (data: PaymentFormValues) => {
    if (!selectedChallan) return;
    const result = await api.put<{ message: string }>("/api/finance/challans", {
      challanId: selectedChallan.id,
      paymentMethod: data.paymentMethod,
    });
    if (result.ok) {
      toast.success("Payment received successfully");
      setIsPaymentOpen(false);
      setSelectedChallan(null);
      payForm.reset();
      fetchData();
    } else {
      toast.error(result.error);
    }
  };

  /* ── Dialog close handlers ─────────────────────────────── */

  const handleCreateClose = () => {
    setIsCreateOpen(false);
    headForm.reset();
    structForm.reset();
    genForm.reset();
  };

  const handlePaymentClose = () => {
    setIsPaymentOpen(false);
    setSelectedChallan(null);
    payForm.reset();
  };

  /* ── Action button label ───────────────────────────────── */

  const actionLabel =
    activeTab === "HEADS"
      ? "Add Fee Category"
      : activeTab === "STRUCTURES"
        ? "Add Pricing Rule"
        : "Generate Bills";

  const actionIcon =
    activeTab === "CHALLANS" ? <Zap size={16} /> : <Plus size={16} />;

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Finance Module"
        subtitle="Manage fee categories, pricing rules, and billing"
        actions={
          <SxButton
            sxVariant="primary"
            icon={actionIcon}
            onClick={() => setIsCreateOpen(true)}
          >
            {actionLabel}
          </SxButton>
        }
      />

      {/* ── Tabs ───────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as ActiveTab)}
      >
        <TabsList>
          <TabsTrigger value="HEADS">1. Fee Categories</TabsTrigger>
          <TabsTrigger value="STRUCTURES">2. Pricing Rules</TabsTrigger>
          <TabsTrigger value="CHALLANS">3. Bills</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Tab content ────────────────────────────────────── */}
      {activeTab === "HEADS" && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <SxDataTable
            columns={headColumns}
            data={heads as unknown as Record<string, unknown>[]}
            loading={loading}
            emptyMessage="No fee categories found."
          />
        </div>
      )}

      {activeTab === "STRUCTURES" && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <SxDataTable
            columns={structureColumns}
            data={structures as unknown as Record<string, unknown>[]}
            loading={loading}
            emptyMessage="No pricing rules found."
          />
        </div>
      )}

      {activeTab === "CHALLANS" && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <SxDataTable
            columns={challanColumns}
            data={challans as unknown as Record<string, unknown>[]}
            loading={loading}
            emptyMessage="No generated bills found."
          />
        </div>
      )}

      {/* ═══════════ CREATE DIALOG ═══════════ */}
      <Dialog open={isCreateOpen} onOpenChange={(o) => !o && handleCreateClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {activeTab === "HEADS" && "New Fee Category"}
              {activeTab === "STRUCTURES" && "New Pricing Rule"}
              {activeTab === "CHALLANS" && "Generate Student Bills"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "HEADS" && "Create a new fee category for your organization."}
              {activeTab === "STRUCTURES" && "Link a fee category to an amount for a campus."}
              {activeTab === "CHALLANS" &&
                "Generate invoices for students by grade. Active pricing rules are applied automatically."}
            </DialogDescription>
          </DialogHeader>

          {/* ── Form: Fee Category ─────────────────────────── */}
          {activeTab === "HEADS" && (
            <Form {...headForm}>
              <form
                onSubmit={headForm.handleSubmit(onHeadSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={headForm.control}
                  name="organizationId"
                  rules={{ required: "Organization is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select org" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {orgs.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.organizationName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={headForm.control}
                  name="name"
                  rules={{ required: "Category name is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Lab Fee" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={headForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fee Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="RECURRING">
                            Recurring (Monthly/Annual)
                          </SelectItem>
                          <SelectItem value="ONE_TIME">One Time</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <SxButton
                    type="button"
                    sxVariant="outline"
                    onClick={handleCreateClose}
                  >
                    Cancel
                  </SxButton>
                  <SxButton
                    type="submit"
                    sxVariant="primary"
                    loading={headForm.formState.isSubmitting}
                  >
                    Save Category
                  </SxButton>
                </DialogFooter>
              </form>
            </Form>
          )}

          {/* ── Form: Pricing Rule ─────────────────────────── */}
          {activeTab === "STRUCTURES" && (
            <Form {...structForm}>
              <form
                onSubmit={structForm.handleSubmit(onStructSubmit)}
                className="space-y-4"
              >
                {/* Target location */}
                <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Target Location
                  </p>
                  <FormField
                    control={structForm.control}
                    name="organizationId"
                    rules={{ required: "Organization is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          value={field.value}
                          onValueChange={(val) => {
                            field.onChange(val);
                            structForm.setValue("campusId", "");
                            structForm.setValue("feeHeadId", "");
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="1. Select Organization" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {orgs.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.organizationName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={structForm.control}
                    name="campusId"
                    rules={{ required: "Campus is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!structOrgId}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="2. Select Campus" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {structCampusList.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={structForm.control}
                  name="feeHeadId"
                  rules={{ required: "Fee category is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fee Category</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!structOrgId}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {structHeadList.map((h) => (
                            <SelectItem key={h.id} value={h.id.toString()}>
                              {h.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={structForm.control}
                    name="amount"
                    rules={{ required: "Amount is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (PKR)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g. 5000"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={structForm.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FREQUENCIES.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={structForm.control}
                    name="name"
                    rules={{ required: "Rule name is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rule Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Standard Tuition"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={structForm.control}
                    name="applicableGrade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grade (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Grade 10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <SxButton
                    type="button"
                    sxVariant="outline"
                    onClick={handleCreateClose}
                  >
                    Cancel
                  </SxButton>
                  <SxButton
                    type="submit"
                    sxVariant="primary"
                    loading={structForm.formState.isSubmitting}
                  >
                    Save Pricing Rule
                  </SxButton>
                </DialogFooter>
              </form>
            </Form>
          )}

          {/* ── Form: Bill Generator ───────────────────────── */}
          {activeTab === "CHALLANS" && (
            <Form {...genForm}>
              <form
                onSubmit={genForm.handleSubmit(onGenerateSubmit)}
                className="space-y-4"
              >
                <div className="rounded-lg border border-info/25 bg-info/10 p-3 text-sm text-info">
                  This engine finds all students in the selected grade and
                  generates invoices from active pricing rules.
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={genForm.control}
                    name="organizationId"
                    rules={{ required: "Organization is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(val) => {
                            field.onChange(val);
                            genForm.setValue("campusId", "");
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select org" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {orgs.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.organizationName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={genForm.control}
                    name="campusId"
                    rules={{ required: "Campus is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campus</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!genOrgId}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select campus" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {genCampusList.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={genForm.control}
                    name="targetGrade"
                    rules={{ required: "Grade is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Grade</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Grade 10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={genForm.control}
                    name="billingMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Month</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MONTHS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={genForm.control}
                  name="dueDate"
                  rules={{ required: "Due date is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <SxButton
                    type="button"
                    sxVariant="outline"
                    onClick={handleCreateClose}
                  >
                    Cancel
                  </SxButton>
                  <SxButton
                    type="submit"
                    sxVariant="primary"
                    loading={genForm.formState.isSubmitting}
                    icon={<Zap size={16} />}
                  >
                    Generate Bills
                  </SxButton>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════ PAYMENT DIALOG ═══════════ */}
      <Dialog
        open={isPaymentOpen}
        onOpenChange={(o) => !o && handlePaymentClose()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
          </DialogHeader>

          {selectedChallan && (
            <div className="space-y-1 rounded-xl border border-border bg-surface p-4">
              <p className="text-sm text-muted">
                Student:{" "}
                <span className="font-medium text-foreground">
                  {selectedChallan.student?.fullName}
                </span>
              </p>
              <p className="text-sm text-muted">
                Challan:{" "}
                <span className="font-data text-foreground">
                  {selectedChallan.challanNo}
                </span>
              </p>
              <p className="text-sm text-muted">
                Amount:{" "}
                <span className="text-lg font-bold text-success">
                  <SxAmount value={Number(selectedChallan.totalAmount)} />
                </span>
              </p>
            </div>
          )}

          <Form {...payForm}>
            <form
              onSubmit={payForm.handleSubmit(onPaymentSubmit)}
              className="space-y-4"
            >
              <FormField
                control={payForm.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CASH">Cash at Counter</SelectItem>
                        <SelectItem value="BANK_TRANSFER">
                          Bank Transfer
                        </SelectItem>
                        <SelectItem value="ONLINE">Online Portal</SelectItem>
                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <SxButton
                  type="button"
                  sxVariant="outline"
                  onClick={handlePaymentClose}
                >
                  Cancel
                </SxButton>
                <SxButton
                  type="submit"
                  sxVariant="primary"
                  loading={payForm.formState.isSubmitting}
                >
                  Confirm Payment
                </SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

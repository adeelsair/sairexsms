"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play } from "lucide-react";

import { api } from "@/lib/api-client";
import {
  SxAmount,
  SxButton,
  SxDataTable,
  SxPageHeader,
  SxStatusBadge,
  type SxColumn,
} from "@/components/sx";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AcademicYear extends Record<string, unknown> {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface PostingRunRow extends Record<string, unknown> {
  id: string;
  month: number;
  year: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  totalStudents: number;
  totalChallans: number;
  totalAmount: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface PostingResult extends Record<string, unknown> {
  postingRunId: string;
  totalStudents: number;
  totalChallans: number;
  totalAmount: number;
  status: "COMPLETED" | "FAILED";
  errorMessage?: string;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: string;
}

interface OrganizationModeEnvelope {
  organizationId: string;
  mode: "SIMPLE" | "PRO";
  isSimple: boolean;
}

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function monthLabel(month: number) {
  return MONTH_OPTIONS.find((m) => Number(m.value) === month)?.label ?? `Month ${month}`;
}

function runStatusVariant(status: PostingRunRow["status"]): "success" | "warning" | "outline" | "info" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "warning";
  if (status === "PROCESSING") return "info";
  return "outline";
}

const columns: SxColumn<PostingRunRow>[] = [
  {
    key: "id",
    header: "Run ID",
    mono: true,
    render: (row) => <span className="font-data text-xs">{row.id}</span>,
  },
  {
    key: "period",
    header: "Month",
    render: (row) => <span>{monthLabel(row.month)} {row.year}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <SxStatusBadge variant={runStatusVariant(row.status)}>{row.status}</SxStatusBadge>
    ),
  },
  {
    key: "totalChallans",
    header: "Challans",
    numeric: true,
    render: (row) => <span className="font-data">{row.totalChallans}</span>,
  },
  {
    key: "totalAmount",
    header: "Total Posted",
    numeric: true,
    mono: true,
    render: (row) => <SxAmount value={row.totalAmount} />,
  },
  {
    key: "startedAt",
    header: "Started",
    render: (row) => (
      <span className="text-xs text-muted-foreground">
        {new Date(row.startedAt).toLocaleString("en-PK")}
      </span>
    ),
  },
];

export default function FinancePostingPage() {
  const router = useRouter();
  const now = new Date();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [dueDate, setDueDate] = useState("");

  const [runs, setRuns] = useState<PostingRunRow[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [running, setRunning] = useState(false);
  const [latestResult, setLatestResult] = useState<PostingResult | null>(null);
  const [modeChecked, setModeChecked] = useState(false);

  const checkMode = useCallback(async () => {
    const result = await api.get<OrganizationModeEnvelope>("/api/organizations/mode");
    if (!result.ok) {
      toast.error(result.error);
      setModeChecked(true);
      return;
    }
    if (result.data.isSimple) {
      toast.error("This area is available in Pro mode.");
      router.replace("/admin/dashboard");
      return;
    }
    setModeChecked(true);
  }, [router]);

  const selectedAcademicYear = useMemo(
    () => academicYears.find((year) => year.id === selectedAcademicYearId) ?? null,
    [academicYears, selectedAcademicYearId],
  );

  const postingYear = useMemo(() => {
    if (!selectedAcademicYear) return now.getFullYear();
    const selectedMonth = Number(month);
    const start = new Date(selectedAcademicYear.startDate);
    const end = new Date(selectedAcademicYear.endDate);
    const startYear = start.getUTCFullYear();
    const endYear = end.getUTCFullYear();
    const startMonth = start.getUTCMonth() + 1;
    return selectedMonth >= startMonth ? startYear : endYear;
  }, [month, selectedAcademicYear, now]);

  const fetchAcademicYears = useCallback(async () => {
    const result = await api.get<ApiEnvelope<AcademicYear[]>>("/api/academic/years");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to load academic years");
      return;
    }

    const years = result.data.data;
    setAcademicYears(years);
    const active = years.find((year) => year.isActive);
    if (active) {
      setSelectedAcademicYearId(active.id);
    } else if (years.length > 0) {
      setSelectedAcademicYearId(years[0].id);
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    const result = await api.get<ApiEnvelope<PostingRunRow[]>>("/api/finance/posting?limit=36");
    if (!result.ok) {
      toast.error(result.error);
      setLoadingRuns(false);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to load posting history");
      setLoadingRuns(false);
      return;
    }
    setRuns(result.data.data);
    setLoadingRuns(false);
  }, []);

  useEffect(() => {
    checkMode();
  }, [checkMode]);

  useEffect(() => {
    if (!modeChecked) return;
    fetchAcademicYears();
    fetchRuns();
  }, [fetchAcademicYears, fetchRuns, modeChecked]);

  if (!modeChecked) {
    return (
      <div className="space-y-6">
        <SxPageHeader
          title="Monthly Posting Trigger"
          subtitle="Checking access mode..."
        />
      </div>
    );
  }

  const runPosting = async () => {
    if (!selectedAcademicYearId) {
      toast.error("Select an academic year first");
      return;
    }

    setRunning(true);
    const result = await api.post<ApiEnvelope<PostingResult>>("/api/finance/posting", {
      academicYearId: selectedAcademicYearId,
      month: Number(month),
      year: postingYear,
      dueDate: dueDate || undefined,
    });

    if (!result.ok) {
      toast.error(result.error);
      setRunning(false);
      return;
    }
    if (!result.data.ok) {
      toast.error(result.data.error ?? "Failed to run monthly posting");
      setRunning(false);
      return;
    }

    setLatestResult(result.data.data);
    toast.success(
      `Posting complete: ${result.data.data.totalChallans} challans, PKR ${result.data.data.totalAmount.toFixed(2)}`,
    );
    await fetchRuns();
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Monthly Posting Trigger"
        subtitle="Run monthly fee posting safely with idempotent posting run tracking"
      />

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Academic Year
            </p>
            <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
              <SelectTrigger>
                <SelectValue placeholder="Select academic year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Month
            </p>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Posting Year
            </p>
            <Input value={String(postingYear)} readOnly />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Due Date (optional)
            </p>
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <SxButton
            sxVariant="primary"
            icon={<Play size={16} />}
            loading={running}
            onClick={runPosting}
          >
            Run Monthly Posting
          </SxButton>
        </div>
      </div>

      {latestResult && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold">Latest Run Summary</p>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted">Run ID</p>
              <p className="font-data text-xs">{latestResult.postingRunId}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Challans</p>
              <p className="font-data">{latestResult.totalChallans}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Students</p>
              <p className="font-data">{latestResult.totalStudents}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Total Posted</p>
              <SxAmount value={latestResult.totalAmount} />
            </div>
          </div>
          {latestResult.errorMessage && (
            <p className="mt-3 text-sm text-warning">{latestResult.errorMessage}</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <SxDataTable
          columns={columns}
          data={runs}
          loading={loadingRuns}
          emptyMessage="No posting runs yet."
        />
      </div>
    </div>
  );
}


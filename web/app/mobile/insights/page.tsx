"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

type OperationalHealthResponse = {
  score: number;
  trend: "IMPROVING" | "WORSENING" | "STABLE";
  breakdown: {
    fee: number;
    attendance: number;
    approvals: number;
    expenses: number;
  };
};

type PrincipalBriefResponse = {
  text: string;
  generatedAt: string;
};

type PredictedDefaulterResponse = {
  count: number;
  threshold: number;
  students: Array<{
    studentId: number;
    name: string;
    admissionNo: string;
    grade: string;
    riskScore: number;
  }>;
};

type AttendanceRiskResponse = {
  threshold: number;
  students: Array<{
    studentId: number;
    name: string;
    className: string;
    sectionName: string;
    riskScore: number;
  }>;
  clusters: Array<{
    className: string;
    riskyCount: number;
  }>;
};

type StudentStabilityResponse = {
  count: number;
  threshold: number;
  students: Array<{
    studentId: number;
    name: string;
    stabilityScore: number;
    feeRisk: number;
    attendanceRisk: number;
    className?: string;
    sectionName?: string;
  }>;
};

function trendLabel(trend: OperationalHealthResponse["trend"]) {
  if (trend === "IMPROVING") return "↑ Improving";
  if (trend === "WORSENING") return "↓ Worsening";
  return "→ Stable";
}

export default function MobileInsightsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");
  const withOrg = (path: string) =>
    orgId ? `${path}${path.includes("?") ? "&" : "?"}orgId=${encodeURIComponent(orgId)}` : path;
  const {
    data: brief,
    isLoading: briefLoading,
    isError: briefError,
  } = useQuery({
    queryKey: ["mobile-principal-brief", orgId ?? "default"],
    queryFn: async (): Promise<PrincipalBriefResponse> => {
      const result = await api.get<PrincipalBriefResponse>(
        withOrg("/api/mobile/insights/principal-brief"),
      );
      if (result.ok) return result.data;
      throw new Error(result.error);
    },
    refetchOnWindowFocus: false,
  });
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mobile-operational-health", orgId ?? "default"],
    queryFn: async (): Promise<OperationalHealthResponse> => {
      const result = await api.get<OperationalHealthResponse>(
        withOrg("/api/mobile/insights/health"),
      );
      if (result.ok) return result.data;
      throw new Error(result.error);
    },
    refetchOnWindowFocus: false,
  });
  const {
    data: predicted,
    isLoading: predictedLoading,
    isError: predictedError,
  } = useQuery({
    queryKey: ["mobile-predicted-defaulters", orgId ?? "default"],
    queryFn: async (): Promise<PredictedDefaulterResponse> => {
      const result = await api.get<PredictedDefaulterResponse>(
        withOrg("/api/mobile/insights/predicted-defaulters"),
      );
      if (result.ok) return result.data;
      throw new Error(result.error);
    },
    refetchOnWindowFocus: false,
  });
  const {
    data: attendanceRisk,
    isLoading: attendanceRiskLoading,
    isError: attendanceRiskError,
  } = useQuery({
    queryKey: ["mobile-attendance-risk", orgId ?? "default"],
    queryFn: async (): Promise<AttendanceRiskResponse> => {
      const result = await api.get<AttendanceRiskResponse>(
        withOrg("/api/mobile/insights/attendance-risk"),
      );
      if (result.ok) return result.data;
      throw new Error(result.error);
    },
    refetchOnWindowFocus: false,
  });
  const {
    data: stability,
    isLoading: stabilityLoading,
    isError: stabilityError,
  } = useQuery({
    queryKey: ["mobile-student-stability", orgId ?? "default"],
    queryFn: async (): Promise<StudentStabilityResponse> => {
      const result = await api.get<StudentStabilityResponse>(
        withOrg("/api/mobile/insights/student-stability"),
      );
      if (result.ok) return result.data;
      throw new Error(result.error);
    },
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-4 p-4 pb-20">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today&apos;s Intelligence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 rounded-xl bg-info/15">
          {briefLoading ? (
            <p className="text-sm text-muted-foreground">
              Generating principal brief...
            </p>
          ) : null}
          {briefError ? (
            <p className="text-sm text-muted-foreground">
              Unable to generate today&apos;s intelligence summary.
            </p>
          ) : null}
          {brief ? (
            <>
              <p className="text-sm text-foreground">{brief.text}</p>
              <p className="text-xs text-muted-foreground">
                Updated {new Date(brief.generatedAt).toLocaleTimeString("en-PK")}
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Operational Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading health score...</p>
          ) : null}

          {isError ? (
            <p className="text-sm text-muted-foreground">
              Failed to load operational health.
            </p>
          ) : null}

          {data ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold">{data.score} / 100</p>
                  <p className="text-sm text-muted-foreground">
                    Risk Trend: {trendLabel(data.trend)}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  Health Score
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-semibold">{data.breakdown.fee}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attendance</span>
                  <span className="font-semibold">{data.breakdown.attendance}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Approvals</span>
                  <span className="font-semibold">{data.breakdown.approvals}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expenses</span>
                  <span className="font-semibold">{data.breakdown.expenses}</span>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        onClick={() => router.push("/mobile/fee/collect")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push("/mobile/fee/collect");
          }
        }}
        className="cursor-pointer"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Potential Fee Risk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {predictedLoading ? (
            <p className="text-sm text-muted-foreground">
              Scanning likely fee defaulters...
            </p>
          ) : null}

          {predictedError ? (
            <p className="text-sm text-muted-foreground">
              Unable to load predictive fee alerts.
            </p>
          ) : null}

          {predicted ? (
            <>
              <div className="rounded-xl border border-border bg-destructive/10 p-3">
                <p className="text-sm font-semibold text-destructive">
                  {predicted.count} students likely to default next cycle
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Risk threshold: {predicted.threshold}
                </p>
              </div>

              {predicted.students.length ? (
                <div className="space-y-2">
                  {predicted.students.slice(0, 5).map((student) => (
                    <div
                      key={student.studentId}
                      className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.admissionNo} · {student.grade}
                        </p>
                      </div>
                      <span className="rounded-full bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive">
                        {student.riskScore}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No high-risk students detected right now.
                </p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        onClick={() => router.push("/mobile/attendance/mark")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push("/mobile/attendance/mark");
          }
        }}
        className="cursor-pointer"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Attendance Warning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {attendanceRiskLoading ? (
            <p className="text-sm text-muted-foreground">
              Detecting attendance risk clusters...
            </p>
          ) : null}

          {attendanceRiskError ? (
            <p className="text-sm text-muted-foreground">
              Unable to load attendance risk alerts.
            </p>
          ) : null}

          {attendanceRisk ? (
            <>
              <div className="rounded-xl border border-border bg-warning/15 p-3">
                <p className="text-sm font-semibold text-warning">
                  {attendanceRisk.students.length} students showing dropout risk
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {attendanceRisk.clusters.length} class cluster
                  {attendanceRisk.clusters.length === 1 ? "" : "s"} detected
                </p>
              </div>

              {attendanceRisk.clusters.length ? (
                <div className="space-y-2">
                  {attendanceRisk.clusters.map((cluster) => (
                    <div
                      key={cluster.className}
                      className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                    >
                      <span className="text-muted-foreground">{cluster.className}</span>
                      <span className="font-semibold">{cluster.riskyCount} risky</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {attendanceRisk.students.length ? (
                <div className="space-y-2">
                  {attendanceRisk.students.slice(0, 5).map((student) => (
                    <div
                      key={student.studentId}
                      className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.className}-{student.sectionName}
                        </p>
                      </div>
                      <span className="rounded-full bg-warning/20 px-2 py-1 text-xs font-semibold text-warning-foreground">
                        {student.riskScore}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No attendance risk clusters detected right now.
                </p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        onClick={() => router.push("/mobile/attendance/mark")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push("/mobile/attendance/mark");
          }
        }}
        className="cursor-pointer"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Student Stability Alert</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stabilityLoading ? (
            <p className="text-sm text-muted-foreground">
              Calculating student stability...
            </p>
          ) : null}

          {stabilityError ? (
            <p className="text-sm text-muted-foreground">
              Unable to load student stability insights.
            </p>
          ) : null}

          {stability ? (
            <>
              <div className="rounded-xl border border-border bg-warning/15 p-3">
                <p className="text-sm font-semibold text-warning">
                  {stability.count} students at risk of instability
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stability threshold: {stability.threshold}
                </p>
              </div>

              {stability.students.length ? (
                <div className="space-y-2">
                  {stability.students.slice(0, 5).map((student) => {
                    const badgeClass =
                      student.stabilityScore <= 40
                        ? "bg-destructive/15 text-destructive"
                        : student.stabilityScore <= 60
                          ? "bg-warning/20 text-warning-foreground"
                          : "bg-warning/10 text-warning";

                    return (
                      <div
                        key={student.studentId}
                        className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Fee {student.feeRisk} · Attendance {student.attendanceRisk}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass}`}
                        >
                          {student.stabilityScore}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No student stability alerts right now.
                </p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

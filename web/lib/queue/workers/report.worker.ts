import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { REPORT_QUEUE } from "../queues";
import { completeJob, failJob, startJob } from "../enqueue";

export interface ReportJobData {
  jobId: string;
  reportType: "FEE_COLLECTION" | "FEE_DEFAULTERS" | "STUDENT_LIST";
  organizationId: string;
  campusId?: number;
  filters?: Record<string, unknown>;
  generatedBy: string;
}

async function processReportJob(bull: BullJob<ReportJobData>): Promise<void> {
  const { prisma } = await import("@/lib/prisma");

  const { jobId, reportType, organizationId, campusId, filters, generatedBy } = bull.data;
  const attemptsMade = bull.attemptsMade + 1;
  const maxAttempts = bull.opts.attempts ?? 3;

  await startJob(jobId, attemptsMade);

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { organizationName: true },
    });

    if (!org) throw new Error(`Organization ${organizationId} not found`);

    let pdfUrl: string;

    if (reportType === "FEE_COLLECTION") {
      pdfUrl = await buildFeeCollectionReport(prisma, org.organizationName, organizationId, campusId, filters, generatedBy);
    } else if (reportType === "FEE_DEFAULTERS") {
      pdfUrl = await buildFeeDefaultersReport(prisma, org.organizationName, organizationId, campusId, filters, generatedBy);
    } else if (reportType === "STUDENT_LIST") {
      pdfUrl = await buildStudentListReport(prisma, org.organizationName, organizationId, campusId, generatedBy);
    } else {
      throw new Error(`Unknown report type: ${reportType}`);
    }

    await completeJob(jobId, { pdfUrl, reportType });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown report error";
    await failJob(jobId, errorMsg, attemptsMade, maxAttempts);
    throw new Error(`Report generation failed: ${errorMsg}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildFeeCollectionReport(prisma: any, orgName: string, orgId: string, campusId: number | undefined, filters: Record<string, unknown> | undefined, generatedBy: string) {
  const { generateReportPdf } = await import("@/lib/pdf/report-pdf");

  const where: Record<string, unknown> = { organizationId: orgId, status: "PAID" };
  if (campusId) where.campusId = campusId;
  if (filters?.fromDate) where.paidAt = { gte: new Date(filters.fromDate as string) };
  if (filters?.toDate) {
    where.paidAt = { ...(where.paidAt as Record<string, unknown> || {}), lte: new Date(filters.toDate as string) };
  }

  const challans = await prisma.feeChallan.findMany({
    where,
    include: { student: true, campus: true },
    orderBy: { paidAt: "desc" },
  });

  const totalCollected = challans.reduce((sum: number, c: { paidAmount: { toNumber?: () => number } }) =>
    sum + (typeof c.paidAmount.toNumber === "function" ? c.paidAmount.toNumber() : Number(c.paidAmount)), 0);

  return generateReportPdf({
    title: "Fee Collection Report",
    subtitle: filters?.fromDate ? `Period: ${filters.fromDate} to ${filters.toDate || "Present"}` : undefined,
    organizationName: orgName,
    generatedBy,
    columns: [
      { key: "challanNo", label: "Challan #", width: 80 },
      { key: "studentName", label: "Student", width: 120 },
      { key: "grade", label: "Grade", width: 40 },
      { key: "campus", label: "Campus", width: 80 },
      { key: "amount", label: "Amount", width: 70, align: "right" },
      { key: "paidAt", label: "Paid On", width: 80 },
    ],
    rows: challans.map((c: { challanNo: string; student: { fullName: string; grade: string }; campus: { name: string }; paidAmount: unknown; paidAt: Date | null }) => ({
      challanNo: c.challanNo,
      studentName: c.student.fullName,
      grade: c.student.grade,
      campus: c.campus.name,
      amount: String(c.paidAmount),
      paidAt: c.paidAt ? new Date(c.paidAt).toLocaleDateString() : "-",
    })),
    summary: [
      { label: "Total Challans:", value: String(challans.length) },
      { label: "Total Collected:", value: `PKR ${totalCollected.toLocaleString()}` },
    ],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildFeeDefaultersReport(prisma: any, orgName: string, orgId: string, campusId: number | undefined, filters: Record<string, unknown> | undefined, generatedBy: string) {
  const { generateReportPdf } = await import("@/lib/pdf/report-pdf");

  const where: Record<string, unknown> = { organizationId: orgId, status: "UNPAID", dueDate: { lt: new Date() } };
  if (campusId) where.campusId = campusId;

  const challans = await prisma.feeChallan.findMany({
    where,
    include: { student: true, campus: true },
    orderBy: { dueDate: "asc" },
  });

  const totalOutstanding = challans.reduce((sum: number, c: { totalAmount: { toNumber?: () => number } }) =>
    sum + (typeof c.totalAmount.toNumber === "function" ? c.totalAmount.toNumber() : Number(c.totalAmount)), 0);

  return generateReportPdf({
    title: "Fee Defaulters Report",
    subtitle: `As of ${new Date().toLocaleDateString()}`,
    organizationName: orgName,
    generatedBy,
    columns: [
      { key: "challanNo", label: "Challan #", width: 80 },
      { key: "studentName", label: "Student", width: 120 },
      { key: "grade", label: "Grade", width: 40 },
      { key: "campus", label: "Campus", width: 80 },
      { key: "amount", label: "Amount", width: 70, align: "right" },
      { key: "dueDate", label: "Due Date", width: 80 },
    ],
    rows: challans.map((c: { challanNo: string; student: { fullName: string; grade: string }; campus: { name: string }; totalAmount: unknown; dueDate: Date }) => ({
      challanNo: c.challanNo,
      studentName: c.student.fullName,
      grade: c.student.grade,
      campus: c.campus.name,
      amount: String(c.totalAmount),
      dueDate: new Date(c.dueDate).toLocaleDateString(),
    })),
    summary: [
      { label: "Total Defaulters:", value: String(challans.length) },
      { label: "Outstanding Amount:", value: `PKR ${totalOutstanding.toLocaleString()}` },
    ],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildStudentListReport(prisma: any, orgName: string, orgId: string, campusId: number | undefined, generatedBy: string) {
  const { generateReportPdf } = await import("@/lib/pdf/report-pdf");

  const where: Record<string, unknown> = { organizationId: orgId };
  if (campusId) where.campusId = campusId;

  const students = await prisma.student.findMany({
    where,
    include: { campus: true },
    orderBy: [{ grade: "asc" }, { fullName: "asc" }],
  });

  return generateReportPdf({
    title: "Student List Report",
    organizationName: orgName,
    generatedBy,
    columns: [
      { key: "admissionNo", label: "Reg #", width: 80 },
      { key: "fullName", label: "Student Name", width: 160 },
      { key: "grade", label: "Grade", width: 50 },
      { key: "campus", label: "Campus", width: 120 },
      { key: "feeStatus", label: "Fee Status", width: 70 },
    ],
    rows: students.map((s: { admissionNo: string; fullName: string; grade: string; campus: { name: string }; feeStatus: string }) => ({
      admissionNo: s.admissionNo,
      fullName: s.fullName,
      grade: s.grade,
      campus: s.campus.name,
      feeStatus: s.feeStatus,
    })),
    summary: [
      { label: "Total Students:", value: String(students.length) },
    ],
  });
}

export function startReportWorker(): Worker<ReportJobData> {
  const worker = new Worker<ReportJobData>(REPORT_QUEUE, processReportJob, {
    connection: getRedisConnection(),
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[Report Worker] completed ${job.id} → ${job.data.reportType}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Report Worker] failed ${job?.id} → ${err.message}`);
  });

  console.log("[Report Worker] Started — listening on queue:", REPORT_QUEUE);
  return worker;
}

import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { CHALLAN_PDF_QUEUE } from "../queues";
import { completeJob, failJob, startJob } from "../enqueue";

export interface ChallanPdfJobData {
  jobId: string;
  challanId: number;
}

async function processChallanPdfJob(bull: BullJob<ChallanPdfJobData>): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { generateChallanPdf } = await import("@/lib/pdf/challan-pdf");

  const { jobId, challanId } = bull.data;
  const attemptsMade = bull.attemptsMade + 1;
  const maxAttempts = bull.opts.attempts ?? 3;

  await startJob(jobId, attemptsMade);

  try {
    const challan = await prisma.feeChallan.findUnique({
      where: { id: challanId },
      include: { student: true, campus: true, organization: true },
    });

    if (!challan) {
      throw new Error(`Challan ${challanId} not found`);
    }

    const pdfUrl = await generateChallanPdf({
      challanNo: challan.challanNo,
      issueDate: new Date(challan.issueDate).toLocaleDateString(),
      dueDate: new Date(challan.dueDate).toLocaleDateString(),
      status: challan.status,
      totalAmount: challan.totalAmount.toString(),
      paidAmount: challan.paidAmount.toString(),
      studentName: challan.student.fullName,
      admissionNo: challan.student.admissionNo,
      grade: challan.student.grade,
      campusName: challan.campus.name,
      organizationName: challan.organization.organizationName,
    });

    await completeJob(jobId, { pdfUrl, challanNo: challan.challanNo });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown PDF error";
    await failJob(jobId, errorMsg, attemptsMade, maxAttempts);
    throw new Error(`Challan PDF generation failed: ${errorMsg}`);
  }
}

export function startChallanPdfWorker(): Worker<ChallanPdfJobData> {
  const worker = new Worker<ChallanPdfJobData>(CHALLAN_PDF_QUEUE, processChallanPdfJob, {
    connection: getRedisConnection(),
    concurrency: 3,
  });

  worker.on("completed", (job) => {
    console.log(`[Challan PDF Worker] completed ${job.id} → challan #${job.data.challanId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Challan PDF Worker] failed ${job?.id} → ${err.message}`);
  });

  console.log("[Challan PDF Worker] Started — listening on queue:", CHALLAN_PDF_QUEUE);
  return worker;
}

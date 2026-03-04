import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { IMPORT_QUEUE } from "../queues";
import { completeJob, failJob, startJob } from "../enqueue";

export interface ImportJobData {
  jobId: string;
  importType: "STUDENTS";
  organizationId: string;
  campusId: number;
  /** CSV content as a string (base64 decoded by the API route) */
  csvData: string;
  importedBy: string;
}

interface CsvStudentRow {
  fullName: string;
  admissionNo: string;
  grade: string;
}

function parseCsv(raw: string): CsvStudentRow[] {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.trim());

  const nameIdx = headers.findIndex((h) => h === "fullname" || h === "full_name" || h === "name" || h === "student name" || h === "student_name");
  const admIdx = headers.findIndex((h) => h === "admissionno" || h === "admission_no" || h === "reg" || h === "reg_no" || h === "registration" || h === "admission no");
  const gradeIdx = headers.findIndex((h) => h === "grade" || h === "class" || h === "section");

  if (nameIdx === -1 || admIdx === -1 || gradeIdx === -1) {
    throw new Error(`CSV must have columns: fullName/name, admissionNo/reg, grade/class. Found: ${headers.join(", ")}`);
  }

  const rows: CsvStudentRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const fullName = cols[nameIdx];
    const admissionNo = cols[admIdx];
    const grade = cols[gradeIdx];

    if (fullName && admissionNo && grade) {
      rows.push({ fullName, admissionNo, grade });
    }
  }

  return rows;
}

async function processImportJob(bull: BullJob<ImportJobData>): Promise<void> {
  const { prisma } = await import("@/lib/prisma");

  const { jobId, importType, organizationId, campusId, csvData } = bull.data;
  const attemptsMade = bull.attemptsMade + 1;
  const maxAttempts = bull.opts.attempts ?? 3;

  await startJob(jobId, attemptsMade);

  try {
    if (importType !== "STUDENTS") {
      throw new Error(`Unsupported import type: ${importType}`);
    }

    const rows = parseCsv(csvData);
    if (rows.length === 0) {
      throw new Error("No valid student rows found in CSV");
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const existing = await prisma.student.findUnique({
          where: { admissionNo: row.admissionNo },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await prisma.student.create({
          data: {
            fullName: row.fullName,
            admissionNo: row.admissionNo,
            grade: row.grade,
            organizationId,
            campusId,
          },
        });
        created++;
      } catch (rowErr) {
        const msg = rowErr instanceof Error ? rowErr.message : "Unknown error";
        errors.push(`Row ${row.admissionNo}: ${msg}`);
      }
    }

    await completeJob(jobId, {
      totalRows: rows.length,
      created,
      skipped,
      errorCount: errors.length,
      errors,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown import error";
    await failJob(jobId, errorMsg, attemptsMade, maxAttempts);
    throw new Error(`Student import failed: ${errorMsg}`);
  }
}

export function startImportWorker(): Worker<ImportJobData> {
  const worker = new Worker<ImportJobData>(IMPORT_QUEUE, processImportJob, {
    connection: getRedisConnection(),
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    console.log(`[Import Worker] completed ${job.id} → ${job.data.importType}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Import Worker] failed ${job?.id} → ${err.message}`);
  });

  console.log("[Import Worker] Started — listening on queue:", IMPORT_QUEUE);
  return worker;
}

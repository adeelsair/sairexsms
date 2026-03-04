import { Worker, Job as BullJob } from "bullmq";
import { getRedisConnection } from "../connection";
import { OTP_QUEUE } from "../queues";
import { completeJob, failJob, startJob } from "../enqueue";

export interface OtpJobData {
  jobId: string;
  channel: "email" | "mobile" | "whatsapp";
  target: string;
  code: string;
}

async function processOtpJob(bull: BullJob<OtpJobData>): Promise<void> {
  const { sendEmail } = await import("@/lib/email");

  const { jobId, channel, target, code } = bull.data;
  const attemptsMade = bull.attemptsMade + 1;
  const maxAttempts = bull.opts.attempts ?? 3;

  await startJob(jobId, attemptsMade);

  try {
    let success = false;

    if (channel === "email") {
      success = await sendEmail({
        to: target,
        subject: "Your verification code — SAIREX SMS",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1e40af;">SAIREX SMS</h2>
            <p>Your verification code is:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0; color: #1e40af;">${code}</p>
            <p style="color: #64748b; font-size: 14px;">
              This code expires in 10 minutes. If you didn't request this, ignore this message.
            </p>
          </div>
        `,
      });
    } else if (channel === "mobile") {
      const { sendSmsMessage } = await import("@/lib/sms");
      try {
        const msg = `Your SAIREX SMS verification code is: ${code}. Valid for 10 minutes.`;
        await sendSmsMessage(target, msg);
        success = true;
      } catch (smsErr) {
        const errMsg = smsErr instanceof Error ? smsErr.message : "";
        if (errMsg.includes("VEEVO_HASH") || errMsg.includes("VEEVO_SENDER")) {
          console.log(`[OTP Worker] DEV MODE — SMS → ${target}: ${code}`);
          success = true;
        } else {
          throw smsErr;
        }
      }
    } else if (channel === "whatsapp") {
      try {
        const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
        await sendWhatsAppMessage(target, `Your SAIREX SMS verification code is: ${code}`);
        success = true;
      } catch (waErr) {
        const errMsg = waErr instanceof Error ? waErr.message : "";
        if (errMsg.includes("init") || errMsg.includes("not ready") || errMsg.includes("Chrome") || errMsg.includes("puppeteer")) {
          console.log(`[OTP Worker] DEV MODE — WhatsApp → ${target}: ${code}`);
          success = true;
        } else {
          throw waErr;
        }
      }
    }

    if (!success) {
      throw new Error(`OTP delivery failed via ${channel} to ${target}`);
    }

    await completeJob(jobId, { channel, target });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown OTP error";
    await failJob(jobId, errorMsg, attemptsMade, maxAttempts);
    throw new Error(`OTP delivery failed to ${target}: ${errorMsg}`);
  }
}

export function startOtpWorker(): Worker<OtpJobData> {
  const worker = new Worker<OtpJobData>(OTP_QUEUE, processOtpJob, {
    connection: getRedisConnection(),
    concurrency: 3,
    limiter: { max: 5, duration: 1000 },
  });

  worker.on("completed", (job) => {
    console.log(`[OTP Worker] completed ${job.id} → ${job.data.channel}:${job.data.target}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[OTP Worker] failed ${job?.id} → ${err.message}`);
  });

  console.log("[OTP Worker] Started — listening on queue:", OTP_QUEUE);
  return worker;
}

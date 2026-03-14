import { enqueue, EMAIL_QUEUE } from "@/lib/queue";
import { sendEmail } from "@/lib/email";

type AuthEmailMode = "queue" | "sync";

function resolveAuthEmailMode(): AuthEmailMode {
  const configured = (process.env.AUTH_EMAIL_DELIVERY_MODE ?? "").trim().toLowerCase();
  if (configured === "sync" || configured === "queue") {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "queue" : "sync";
}

export async function dispatchAuthEmail(opts: {
  to: string;
  subject: string;
  html: string;
  userId?: number;
}): Promise<void> {
  const mode = resolveAuthEmailMode();
  if (mode === "sync") {
    const sent = await sendEmail({
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (!sent) {
      throw new Error(`Failed to send auth email to ${opts.to}`);
    }
    return;
  }

  await enqueue({
    type: "EMAIL",
    queue: EMAIL_QUEUE,
    userId: opts.userId,
    payload: {
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    },
  });
}


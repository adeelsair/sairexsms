import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { OnebillAdapter } from "@/lib/payments/adapters/onebill.adapter";
import { StripeAdapter } from "@/lib/payments/adapters/stripe.adapter";

describe("webhook adapter signature verification", () => {
  it("verifies Stripe signature using raw body", () => {
    const webhookSecret = "stripe-secret";
    const adapter = new StripeAdapter({ webhookSecret });
    const timestamp = "1730000000";
    const rawBody = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1" } },
    });
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const digest = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    const signature = `t=${timestamp},v1=${digest}`;

    const valid = adapter.verifyWebhook(payload, signature, { "stripe-signature": signature }, rawBody);
    expect(valid).toBe(true);
  });

  it("rejects Stripe signature when raw body is tampered", () => {
    const webhookSecret = "stripe-secret";
    const adapter = new StripeAdapter({ webhookSecret });
    const timestamp = "1730000000";
    const rawBody = JSON.stringify({ id: "evt_2", type: "checkout.session.completed" });
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const digest = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    const signature = `t=${timestamp},v1=${digest}`;
    const tampered = `${rawBody} `;

    const valid = adapter.verifyWebhook(payload, signature, { "stripe-signature": signature }, tampered);
    expect(valid).toBe(false);
  });

  it("verifies OneBill signature against raw body", () => {
    const webhookSecret = "onebill-secret";
    const adapter = new OnebillAdapter({ webhookSecret });
    const rawBody = JSON.stringify({
      transactionId: "txn-123",
      amount: 5000,
      status: "PAID",
    });
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const signature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

    const valid = adapter.verifyWebhook(payload, signature, {}, rawBody);
    expect(valid).toBe(true);
  });
});


export const paymentsConfig = {
  onebill: {
    merchantId: process.env.ONEBILL_MERCHANT_ID,
    apiKey: process.env.ONEBILL_API_KEY,
    baseUrl: process.env.ONEBILL_BASE_URL ?? "https://api.1bill.com.pk",
    webhookSecret: process.env.ONEBILL_WEBHOOK_SECRET,
  },
};


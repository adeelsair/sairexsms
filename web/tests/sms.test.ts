import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { normalizePkPhone, sendSmsMessage } from "@/lib/sms";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedAxios = vi.mocked(axios, { deep: true });

describe("normalizePkPhone", () => {
  it("normalizes local 03xxxxxxxxx format to 92xxxxxxxxxx", () => {
    expect(normalizePkPhone("0300-1234567")).toBe("923001234567");
  });

  it("preserves already normalized 92 format", () => {
    expect(normalizePkPhone("+923001234567")).toBe("923001234567");
  });
});

describe("sendSmsMessage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SMS_DRY_RUN;
    delete process.env.SMS_PROVIDER;
    delete process.env.VEEVO_HASH;
    delete process.env.VEEVO_SENDER;
    delete process.env.VEEVO_LOGIN_ID;
    delete process.env.VEEVO_PASSWORD;
    delete process.env.ANDROID_SMS_GATEWAY_URL;
    delete process.env.ANDROID_SMS_GATEWAY_TOKEN;
    delete process.env.SMSMOBILE_API_KEY;
    delete process.env.SMSMOBILE_API_URL;
    delete process.env.SMSMOBILE_SEND_WA;
    delete process.env.SMSMOBILE_SEND_SMS;
  });

  it("throws when provider credentials are missing and dry-run is disabled", async () => {
    await expect(sendSmsMessage("03001234567", "Hello")).rejects.toThrow(
      "VEEVO_HASH or VEEVO_SENDER is missing",
    );
  });

  it("succeeds in dry-run mode without provider credentials", async () => {
    process.env.SMS_DRY_RUN = "true";
    await expect(sendSmsMessage("03001234567", "Hello")).resolves.toBeUndefined();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("calls provider endpoint when credentials are configured", async () => {
    process.env.VEEVO_HASH = "hash";
    process.env.VEEVO_SENDER = "sender";
    mockedAxios.get.mockResolvedValue({ status: 200, data: { STATUS: "SUCCESS" } } as never);

    await sendSmsMessage("03001234567", "Hi");

    expect(mockedAxios.get).toHaveBeenCalledOnce();
    expect(mockedAxios.get.mock.calls[0]?.[0]).toContain("receivenum=923001234567");
  });

  it("throws when provider reports FAILED in object response", async () => {
    process.env.VEEVO_HASH = "hash";
    process.env.VEEVO_SENDER = "sender";
    mockedAxios.get.mockResolvedValue({ status: 200, data: { STATUS: "FAILED" } } as never);

    await expect(sendSmsMessage("03001234567", "Hi")).rejects.toThrow("Veevo SMS failed");
  });

  it("throws when provider reports FAILED in string response", async () => {
    process.env.VEEVO_HASH = "hash";
    process.env.VEEVO_SENDER = "sender";
    mockedAxios.get.mockResolvedValue({ status: 200, data: "FAILED: invalid sender" } as never);

    await expect(sendSmsMessage("03001234567", "Hi")).rejects.toThrow("Veevo SMS failed");
  });

  it("throws when android gateway url is missing", async () => {
    process.env.SMS_PROVIDER = "android_gateway";
    await expect(sendSmsMessage("03001234567", "Hi")).rejects.toThrow(
      "ANDROID_SMS_GATEWAY_URL is missing",
    );
  });

  it("calls android gateway endpoint when configured", async () => {
    process.env.SMS_PROVIDER = "android_gateway";
    process.env.ANDROID_SMS_GATEWAY_URL = "https://phone-gateway.local/send";
    process.env.ANDROID_SMS_GATEWAY_TOKEN = "token";
    mockedAxios.post.mockResolvedValue({ status: 200, data: { status: "ok" } } as never);

    await sendSmsMessage("03001234567", "Hi from gateway");

    expect(mockedAxios.post).toHaveBeenCalledOnce();
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://phone-gateway.local/send",
      { to: "923001234567", message: "Hi from gateway" },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("throws when smsmobileapi key is missing", async () => {
    process.env.SMS_PROVIDER = "smsmobileapi";
    await expect(sendSmsMessage("03001234567", "Hi")).rejects.toThrow(
      "SMSMOBILE_API_KEY is missing",
    );
  });

  it("calls smsmobileapi endpoint when configured", async () => {
    process.env.SMS_PROVIDER = "smsmobileapi";
    process.env.SMSMOBILE_API_KEY = "api-key";
    mockedAxios.post.mockResolvedValue({ status: 200, data: "OK" } as never);

    await sendSmsMessage("03001234567", "Hi from smsmobileapi");

    expect(mockedAxios.post).toHaveBeenCalledOnce();
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.smsmobileapi.com/sendsms/",
      expect.stringContaining("apikey=api-key"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      }),
    );
  });
});


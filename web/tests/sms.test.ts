import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { normalizePkPhone, sendSmsMessage } from "@/lib/sms";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
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
    delete process.env.VEEVO_HASH;
    delete process.env.VEEVO_SENDER;
    delete process.env.VEEVO_LOGIN_ID;
    delete process.env.VEEVO_PASSWORD;
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
});


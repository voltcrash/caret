import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { device, approve, deny } = vi.hoisted(() => ({
  device: vi.fn(),
  approve: vi.fn(),
  deny: vi.fn(),
}));
vi.mock("../../src/features/auth/client.client", () => ({
  getAuthClient: () => ({ device: Object.assign(device, { approve, deny }) }),
}));

import {
  decideDeviceCode,
  reviewDeviceCode,
} from "../../src/ts/ape/device-auth";

beforeEach(() => {
  device.mockReset();
  approve.mockReset();
  deny.mockReset();
});
describe("device authorization API", () => {
  it("claims a code with the signed-in browser and accepts the terminal client", async () => {
    device.mockResolvedValue({
      data: {
        user_code: "ABCDEFGH",
        client_id: "oxytype-tui",
        status: "pending",
      },
      error: null,
    });
    expect(await reviewDeviceCode("ABCDEFGH")).toMatchObject({
      client_id: "oxytype-tui",
    });
    expect(device).toHaveBeenCalledWith({ query: { user_code: "ABCDEFGH" } });
  });
  it.each([undefined, "unrecognized-client"])(
    "rejects a request without terminal ownership (%s)",
    async (client_id) => {
      device.mockResolvedValue({
        data: { status: "pending", client_id },
        error: null,
      });
      await expect(reviewDeviceCode("ABCDEFGH")).rejects.toThrow(
        "cannot be reviewed by this account",
      );
    },
  );
  it("preserves the server's expired-code explanation", async () => {
    device.mockResolvedValue({
      data: null,
      error: {
        error: "expired_token",
        error_description: "Code expired. Start again.",
      },
    });
    await expect(reviewDeviceCode("ABCDEFGH")).rejects.toThrow(
      "Code expired. Start again.",
    );
  });
  it.each(["approve", "deny"] as const)(
    "sends an explicit %s decision and propagates ownership errors",
    async (decision) => {
      const action = decision === "approve" ? approve : deny;
      action.mockResolvedValue({ data: { success: true }, error: null });
      await decideDeviceCode("ABCDEFGH", decision);
      expect(action).toHaveBeenCalledWith({ userCode: "ABCDEFGH" });
      action.mockResolvedValue({
        data: null,
        error: { error_description: "Not your request" },
      });
      await expect(decideDeviceCode("ABCDEFGH", decision)).rejects.toThrow(
        "Not your request",
      );
    },
  );
});

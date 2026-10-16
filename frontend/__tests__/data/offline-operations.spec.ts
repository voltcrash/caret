import { expect, it, vi } from "vite-plus/test";
vi.mock("virtual:env-config", () => ({ envConfig: { devOffline: true } }));
import { operation } from "../../src/data/operations";
import { operationCalls } from "../__harness__/operations";

it("answers offline requests without invoking any server function", async () => {
  expect(await operation("configuration.get")).toMatchObject({
    ok: false,
    status: 503,
    message: expect.stringContaining("frontend-only"),
  });
  expect(
    await operation("results.add", { body: { result: {} as never } }),
  ).toMatchObject({ ok: false, status: 503 });
  expect(operationCalls).not.toHaveBeenCalled();
});

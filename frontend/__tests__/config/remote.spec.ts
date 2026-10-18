import { mockHttpFixture } from "../__harness__/operations";
import { beforeEach, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => {
  let finishLocal!: () => void;
  return {
    local: new Promise<void>((resolve) => {
      finishLocal = resolve;
    }),
    finishLocal: () => finishLocal(),
    get: vi.fn(),
    apply: vi.fn(),
    save: vi.fn(),
  };
});
vi.mock("../../src/ts/config/lifecycle", () => ({
  applyConfig: state.apply,
}));
vi.mock("../../src/ts/config/persistence", () => ({
  saveFullConfigToLocalStorage: state.save,
}));
vi.mock("../../src/ts/config/store", () => ({
  getMutableConfig: (() => {
    const storedConfig = { theme: "local" };
    return () => storedConfig;
  })(),
}));
vi.mock("../../src/ts/config/utils", () => ({
  migrateConfig: (config: unknown) => config,
}));

vi.mock("../../src/app/readiness", () => ({
  preferencesReadiness: () => ({ wait: async () => state.local }),
}));
beforeEach(() => vi.clearAllMocks());

it("fetches server settings immediately and applies them after local settings", async () => {
  const config = { theme: "remote" };
  state.get.mockResolvedValue({ status: 200, body: { data: config } });
  const { updateFromServer } = await import("../../src/ts/config/remote");
  const updating = updateFromServer();
  await vi.waitFor(() => expect(state.get).toHaveBeenCalledOnce());
  expect(state.apply).not.toHaveBeenCalled();
  state.finishLocal();
  await updating;
  expect(state.apply).toHaveBeenCalledWith(config);
  expect(state.save).toHaveBeenCalledWith(true);
});

it("does not apply prefetched settings when account initialization fails", async () => {
  state.get.mockResolvedValue({
    status: 200,
    body: { data: { theme: "remote" } },
  });
  const { updateFromServer } = await import("../../src/ts/config/remote");
  let fail!: (error: Error) => void;
  const accountReady = new Promise<void>((_resolve, reject) => {
    fail = reject;
  });
  const updating = updateFromServer(accountReady);
  const failed = expect(updating).rejects.toThrow("Account failed");
  await Promise.resolve();
  fail(new Error("Account failed"));
  await failed;
  expect(state.get).toHaveBeenCalledOnce();
  expect(state.apply).not.toHaveBeenCalled();
  expect(state.save).not.toHaveBeenCalled();
});

mockHttpFixture("configs.get", async (input) => await state.get(input));

import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  reset: vi.fn(async () => undefined),
  refetch: vi.fn(),
}));
const [userId, setUserId] = createSignal<string | null>(null);
vi.mock("../../../src/ts/states/core", () => ({
  isAuthenticated: () => userId() !== null,
}));
vi.mock("../../../src/ts/queries", () => ({
  getQueryClient: () => ({ resetQueries: mocks.reset }),
}));
vi.mock("../../../src/ts/collections/results", () => ({
  refetchResults: mocks.refetch,
}));

import { AccountRuntime } from "../../../src/ts/components/core/AccountRuntime";

describe("AccountRuntime", () => {
  it("resets user queries on auth changes and refetches history on sign-in", async () => {
    const view = render(() => <AccountRuntime />);
    expect(mocks.reset).not.toHaveBeenCalled();
    setUserId("a");
    expect(mocks.reset).toHaveBeenCalledWith({ queryKey: ["user"] });
    await vi.waitFor(() => expect(mocks.refetch).toHaveBeenCalledOnce());
    setUserId(null);
    expect(mocks.reset).toHaveBeenCalledTimes(2);
    view.unmount();
    setUserId("b");
    expect(mocks.reset).toHaveBeenCalledTimes(2);
  });
});

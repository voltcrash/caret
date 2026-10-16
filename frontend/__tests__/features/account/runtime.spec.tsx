import { cleanup, render } from "@solidjs/testing-library";
import { QueryClientProvider } from "@tanstack/solid-query";
import { afterEach, expect, it, vi } from "vite-plus/test";

const loads = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../../src/ts/auth", () => ({ loadUser: loads }));

import { requireApplication } from "../../../src/app/application";
import { AccountRuntime } from "../../../src/features/account/runtime.client";
import { sessionKey } from "../../../src/features/auth/session";
import { setUserState } from "../../../src/features/auth/state.client";
import { isAuthAvailable } from "../../../src/ts/auth-client";

const user = (
  uid: string,
  registered = true,
): {
  uid: string;
  email: string;
  displayName: string;
  providerData: never[];
  registered: boolean;
} => ({
  uid,
  email: `${uid}@example.test`,
  displayName: uid,
  providerData: [],
  registered,
});

const tick = async (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  cleanup();
  setUserState(null);
  loads.mockClear();
});

it("loads account data once per registered actor after the actor switches", async () => {
  const app = requireApplication();
  app.queryClient.setQueryData(sessionKey, {
    user: user("a"),
    signUpEnabled: true,
  });
  render(() => (
    <QueryClientProvider client={app.queryClient}>
      <AccountRuntime />
    </QueryClientProvider>
  ));
  await tick();
  expect(loads).not.toHaveBeenCalled();
  expect(isAuthAvailable()).toBe(true);
  setUserState(user("a"));
  await tick();
  expect(loads).toHaveBeenCalledTimes(1);
  app.queryClient.setQueryData(sessionKey, {
    user: user("a"),
    signUpEnabled: true,
  });
  await tick();
  expect(loads).toHaveBeenCalledTimes(1);
  app.queryClient.setQueryData(sessionKey, {
    user: user("b"),
    signUpEnabled: true,
  });
  setUserState(user("b"));
  await tick();
  expect(loads).toHaveBeenCalledTimes(2);
  expect(loads).toHaveBeenLastCalledWith(expect.objectContaining({ uid: "b" }));
});

it("never loads account data for an unfinished signup", async () => {
  const app = requireApplication();
  app.queryClient.setQueryData(sessionKey, {
    user: user("pending", false),
    signUpEnabled: true,
  });
  setUserState(user("pending", false));
  render(() => (
    <QueryClientProvider client={app.queryClient}>
      <AccountRuntime />
    </QueryClientProvider>
  ));
  await tick();
  expect(loads).not.toHaveBeenCalled();
});

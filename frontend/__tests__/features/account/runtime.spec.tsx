import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { QueryClientProvider } from "@tanstack/solid-query";
import { afterEach, expect, it, vi } from "vite-plus/test";

const loads = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../../src/ts/auth", () => ({ loadUser: loads }));
const clearSentryUser = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../../src/ts/sentry", () => ({ clearUser: clearSentryUser }));
// Account page warmup is outside these actor/session tests. Keep its idle import
// from continuing after the browser test frame has closed.
vi.mock("../../../src/features/account/page", () => ({
  preloadAccount: vi.fn(async () => undefined),
}));
// Session refetches stay pending; tests drive the cached session directly.
vi.mock("../../../src/functions/session", () => ({
  getSessionState: async () => new Promise(() => undefined),
}));

import { requireApplication } from "../../../src/app/application";
import { AccountRuntime } from "../../../src/features/account/runtime.client";
import { useAccountSettled } from "../../../src/features/account/settled.client";
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
  clearSentryUser.mockClear();
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
  await waitFor(() => expect(loads).toHaveBeenCalledTimes(1));
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
  await waitFor(() => expect(loads).toHaveBeenCalledTimes(2));
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

it("settles guests with the session and registered actors after their load", async () => {
  const app = requireApplication();
  let finish = (): void => undefined;
  loads.mockImplementationOnce(
    async () =>
      new Promise<undefined>((resolve) => (finish = () => resolve(undefined))),
  );
  app.queryClient.setQueryData(sessionKey, { user: null, signUpEnabled: true });
  let settled!: () => boolean | undefined;
  function Probe(): null {
    settled = useAccountSettled();
    return null;
  }
  render(() => (
    <QueryClientProvider client={app.queryClient}>
      <AccountRuntime />
      <Probe />
    </QueryClientProvider>
  ));
  await tick();
  expect(settled()).toBe(false);
  app.queryClient.setQueryData(sessionKey, {
    user: user("a"),
    signUpEnabled: true,
  });
  setUserState(user("a"));
  await tick();
  await waitFor(() => expect(loads).toHaveBeenCalledTimes(1));
  expect(settled()).toBeUndefined();
  finish();
  await tick();
  await waitFor(() => expect(settled()).toBe(true));
  setUserState(null);
  app.queryClient.setQueryData(sessionKey, { user: null, signUpEnabled: true });
  await tick();
  await waitFor(() => expect(settled()).toBe(false));
  // Signing back in waits for a fresh load of the same account.
  loads.mockImplementationOnce(
    async () =>
      new Promise<undefined>((resolve) => (finish = () => resolve(undefined))),
  );
  app.queryClient.setQueryData(sessionKey, {
    user: user("a"),
    signUpEnabled: true,
  });
  setUserState(user("a"));
  await tick();
  await waitFor(() => expect(loads).toHaveBeenCalledTimes(2));
  expect(settled()).toBeUndefined();
  finish();
  await tick();
  await waitFor(() => expect(settled()).toBe(true));
});

it("retries a transient load failure once back online and stops after success", async () => {
  const app = requireApplication();
  loads
    .mockImplementationOnce(async () => "unavailable" as never)
    .mockImplementationOnce(async () => "loaded" as never);
  app.queryClient.setQueryData(sessionKey, {
    user: user("retry"),
    signUpEnabled: true,
  });
  render(() => (
    <QueryClientProvider client={app.queryClient}>
      <AccountRuntime />
    </QueryClientProvider>
  ));
  setUserState(user("retry"));
  await tick();
  await waitFor(() => expect(loads).toHaveBeenCalledTimes(1));
  window.dispatchEvent(new Event("online"));
  await tick();
  await waitFor(() => expect(loads).toHaveBeenCalledTimes(2));
  expect(loads).toHaveBeenLastCalledWith(user("retry"), {
    notifyOnFailure: false,
  });
  window.dispatchEvent(new Event("online"));
  await tick();
  expect(loads).toHaveBeenCalledTimes(2);
});

it("clears the error-report identity when the account signs out", async () => {
  const app = requireApplication();
  app.queryClient.setQueryData(sessionKey, {
    user: user("a"),
    signUpEnabled: true,
  });
  setUserState(user("a"));
  render(() => (
    <QueryClientProvider client={app.queryClient}>
      <AccountRuntime />
    </QueryClientProvider>
  ));
  await tick();
  await waitFor(() => expect(loads).toHaveBeenCalledOnce());
  clearSentryUser.mockClear();
  app.queryClient.setQueryData(sessionKey, { user: null, signUpEnabled: true });
  setUserState(null);
  await tick();
  await waitFor(() => expect(clearSentryUser).toHaveBeenCalledOnce());
});

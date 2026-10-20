import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { QueryClient } from "@tanstack/solid-query";
import type { SessionState } from "@oxytype/schemas/auth-session";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  popup: vi.fn(),
  signup: vi.fn(),
  setUser: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  unlink: vi.fn(),
  accounts: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("../../../src/functions/session", () => ({
  getSessionState: mocks.session,
}));
vi.mock("../../../src/functions/signup", () => ({
  completeSignUp: mocks.signup,
}));
vi.mock("../../../src/features/auth/popup.client", () => ({
  requestOAuth: mocks.popup,
}));
vi.mock("../../../src/features/auth/state.client", () => ({
  setUserState: mocks.setUser,
}));
vi.mock("../../../src/features/auth/client.client", () => ({
  getAuthClient: () => ({
    signOut: mocks.signOut,
    updateUser: mocks.updateUser,
    unlinkAccount: mocks.unlink,
    listAccounts: mocks.accounts,
    $fetch: mocks.cancel,
  }),
}));
import { createAuthActions } from "../../../src/features/auth/actions.client";
import {
  authRedirect,
  sessionKey,
  sessionOptions,
} from "../../../src/features/auth/session";
import { requireSession } from "../../../src/features/auth/guard";
const user = {
  uid: "a",
  email: "a@example.test",
  displayName: "A",
  registered: true,
  providerData: [{ providerId: "github" as const, email: "a@example.test" }],
};
let state: SessionState;
let client: QueryClient;
const invalidated = vi.fn(async () => undefined);
beforeEach(() => {
  vi.resetAllMocks();
  state = { user, signUpEnabled: true };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.session.mockImplementation(async () => state);
  for (const fn of [
    mocks.signOut,
    mocks.updateUser,
    mocks.unlink,
    mocks.cancel,
  ]) {
    fn.mockResolvedValue({ data: { success: true }, error: null });
  }
});
afterEach(() => client.clear());
it("updates Query and routes after login/logout without loading legacy snapshots", async () => {
  const actions = createAuthActions(client, invalidated);
  await actions.login("github");
  expect(mocks.popup).toHaveBeenCalledWith("github");
  expect(client.getQueryData(sessionKey)).toEqual(state);
  expect(mocks.setUser).toHaveBeenLastCalledWith(user);
  state = { user: null, signUpEnabled: true };
  await actions.logout();
  expect(client.getQueryData(sessionKey)).toEqual(state);
  expect(mocks.setUser).toHaveBeenLastCalledWith(null);
  expect(invalidated).toHaveBeenCalledTimes(2);
});
it("preserves onboarding identity when signup fails, allowing retry", async () => {
  const actions = createAuthActions(client, invalidated);
  mocks.signup.mockRejectedValueOnce(new Error("Username unavailable"));
  await expect(actions.complete("Name", "challenge")).rejects.toThrow(
    "Username unavailable",
  );
  expect(mocks.cancel).not.toHaveBeenCalled();
  expect(mocks.signOut).not.toHaveBeenCalled();
  await actions.complete("OtherName", "new-challenge");
  expect(mocks.updateUser).toHaveBeenCalledWith({ name: "OtherName" });
  expect(invalidated).toHaveBeenCalledOnce();
});
it("cancels unfinished registration through auth and clears the session", async () => {
  state = { user: null, signUpEnabled: true };
  await createAuthActions(client, invalidated).cancel();
  expect(mocks.cancel).toHaveBeenCalledWith("/cancel-sign-up", {
    method: "POST",
  });
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(mocks.setUser).toHaveBeenCalledWith(null);
});
it("rejects cross-account reauthentication before sensitive actions", async () => {
  const actions = createAuthActions(client, invalidated);
  mocks.popup.mockImplementation(async () => {
    state = { ...state, user: { ...user, uid: "b" } };
  });
  await expect(actions.reauthenticate("github")).rejects.toThrow(
    "same account",
  );
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(mocks.unlink).not.toHaveBeenCalled();
});
it("requires another supported method before unlinking", async () => {
  await expect(
    createAuthActions(client, invalidated).unlink("github"),
  ).rejects.toThrow("at least one");
  expect(mocks.unlink).not.toHaveBeenCalled();
});
it("guards private routes and preserves local redirect search/hash", async () => {
  expect(await requireSession(client, "/device?user_code=ABC#confirm")).toEqual(
    user,
  );
  // Fresh sessions (including SSR hydration) avoid another round trip.
  await requireSession(client, "/account");
  expect(mocks.session).toHaveBeenCalledOnce();
  state = { user: null, signUpEnabled: true };
  client.setQueryData(
    sessionKey,
    { user, signUpEnabled: true },
    {
      updatedAt: Date.now() - 30_001,
    },
  );
  await expect(
    requireSession(client, "/device?user_code=ABC#confirm"),
  ).rejects.toMatchObject({
    options: {
      to: "/login",
      search: { redirect: "/device?user_code=ABC#confirm" },
    },
  });
  state = { user: { ...user, registered: false }, signUpEnabled: true };
  await client.invalidateQueries({ queryKey: sessionKey });
  await expect(requireSession(client, "/account")).rejects.toMatchObject({
    options: { to: "/login", search: { redirect: "/account" } },
  });
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "\n/evil",
  ]) {
    expect(authRedirect(value)).toBe("/");
  }
});

it("reauthenticates with the remaining provider before unlinking and refreshes provider UI", async () => {
  state = {
    ...state,
    user: {
      ...user,
      providerData: [
        ...user.providerData,
        { providerId: "google", email: user.email },
      ],
    },
  };
  mocks.accounts.mockResolvedValue({
    data: [{ id: "linked-github", providerId: "github" }],
    error: null,
  });
  mocks.unlink.mockImplementation(async () => {
    state = {
      ...state,
      user: {
        ...user,
        providerData: [{ providerId: "google", email: user.email }],
      },
    };
    return { data: { success: true }, error: null };
  });
  await createAuthActions(client, invalidated).unlink("github");
  expect(mocks.popup).toHaveBeenCalledWith("google");
  expect(mocks.unlink).toHaveBeenCalledWith({ accountId: "linked-github" });
  expect(client.getQueryData(sessionKey)).toEqual(state);
  expect(invalidated).toHaveBeenCalledTimes(2);
});

it("forces refresh after auth changes even while the cached session is fresh", async () => {
  client.setQueryData(sessionKey, { user: null, signUpEnabled: true });
  await createAuthActions(client, invalidated).login("github");
  expect(mocks.session).toHaveBeenCalledOnce();
  expect(client.getQueryData(sessionOptions().queryKey)).toEqual(state);
});

import type { SessionState } from "@oxytype/schemas/auth-session";

import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const signOutRequest = vi.hoisted(() => vi.fn());
const sessionRequest = vi.hoisted(() => vi.fn());
vi.mock("../../../src/functions/session", () => ({
  getSessionState: sessionRequest,
}));
vi.mock("../../../src/features/auth/client.client", () => ({
  getAuthClient: () => ({ signOut: signOutRequest }),
}));

import { requireApplication } from "../../../src/app/application";
import { sessionKey } from "../../../src/features/auth/session";
import {
  getAuthenticatedUser,
  setUserState,
} from "../../../src/features/auth/state.client";
import { refreshSession, signOut } from "../../../src/ts/auth-client";

const user = {
  uid: "a",
  email: "a@example.test",
  displayName: "A",
  registered: true,
  providerData: [],
};

beforeEach(() => {
  signOutRequest.mockReset();
  sessionRequest.mockReset();
  signOutRequest.mockResolvedValue({ data: { success: true }, error: null });
  requireApplication().queryClient.setQueryData<SessionState>(sessionKey, {
    user,
    signUpEnabled: false,
  });
  setUserState(user);
});

it("legacy profile refresh updates the canonical fresh session cache", async () => {
  const updated = { ...user, displayName: "Updated" };
  sessionRequest.mockResolvedValue({ user: updated, signUpEnabled: false });
  await expect(refreshSession()).resolves.toEqual(updated);
  expect(sessionRequest).toHaveBeenCalledOnce();
  expect(requireApplication().queryClient.getQueryData(sessionKey)).toEqual({
    user: updated,
    signUpEnabled: false,
  });
  expect(getAuthenticatedUser()).toEqual(updated);
});
afterEach(() => setUserState(null));

it("clears the canonical session and account together after header sign-out", async () => {
  const lease = requireApplication().accountData.capture();
  await signOut();
  expect(requireApplication().queryClient.getQueryData(sessionKey)).toEqual({
    user: null,
    signUpEnabled: false,
  });
  expect(getAuthenticatedUser()).toBeNull();
  expect(lease.isCurrent()).toBe(false);
});

it("keeps the session and account when the server rejects sign-out", async () => {
  signOutRequest.mockResolvedValue({
    data: null,
    error: { message: "Sign-out unavailable", status: 503 },
  });
  await expect(signOut()).rejects.toThrow("Sign-out unavailable");
  expect(
    requireApplication().queryClient.getQueryData<SessionState>(sessionKey)
      ?.user,
  ).toEqual(user);
  expect(getAuthenticatedUser()).toEqual(user);
});

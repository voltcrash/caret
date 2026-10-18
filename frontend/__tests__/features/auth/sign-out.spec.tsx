import type { SessionState } from "@oxytype/schemas/auth-session";

import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const signOutRequest = vi.hoisted(() => vi.fn());
vi.mock("../../../src/features/auth/client.client", () => ({
  getAuthClient: () => ({ signOut: signOutRequest }),
}));

import { requireApplication } from "../../../src/app/application";
import { sessionKey } from "../../../src/features/auth/session";
import {
  getAuthenticatedUser,
  setUserState,
} from "../../../src/features/auth/state.client";
import { signOut } from "../../../src/ts/auth-client";

const user = {
  uid: "a",
  email: "a@example.test",
  displayName: "A",
  registered: true,
  providerData: [],
};

beforeEach(() => {
  signOutRequest.mockReset();
  signOutRequest.mockResolvedValue({ data: { success: true }, error: null });
  requireApplication().queryClient.setQueryData<SessionState>(sessionKey, {
    user,
    signUpEnabled: false,
  });
  setUserState(user);
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

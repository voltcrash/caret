import { afterEach, expect, it } from "vite-plus/test";
import { requireApplication } from "../../../src/app/application";
import {
  getAuthenticatedUser,
  setUserState,
} from "../../../src/features/auth/state.client";
afterEach(() => setUserState(null));
it("rotates private requests, collections and cache identity on account switch and logout", () => {
  const app = requireApplication();
  const user = {
    uid: "a",
    email: "a@example.test",
    displayName: "A",
    providerData: [],
  };
  setUserState(user);
  const lease = app.accountData.capture();
  app.queryClient.setQueryData(["user", "a", "summary"], { private: true });
  app.queryClient.setQueryData(["public", "stats"], { count: 1 });
  setUserState({ ...user, uid: "b" });
  expect(lease.signal.aborted).toBe(true);
  expect(
    app.queryClient.getQueryData(["user", "a", "summary"]),
  ).toBeUndefined();
  expect(app.queryClient.getQueryData(["public", "stats"])).toEqual({
    count: 1,
  });
  expect(getAuthenticatedUser()?.uid).toBe("b");
  const signedIn = app.accountData.capture();
  setUserState(null);
  expect(signedIn.signal.aborted).toBe(true);
  expect(app.accountData.actor()).toBeNull();
  expect(getAuthenticatedUser()).toBeNull();
});

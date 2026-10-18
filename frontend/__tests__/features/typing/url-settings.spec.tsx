import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
}));
const [search, setSearch] = createSignal("");
const [pathname, setPathname] = createSignal("/");
const [signedIn, setSignedIn] = createSignal<boolean | undefined>();
const [status, setStatus] = createSignal<"loading" | "ready">("loading");
vi.mock("@tanstack/solid-router", () => ({
  useLocation:
    (options: { select: (location: object) => string | undefined }) => () =>
      options.select({ pathname: pathname(), searchStr: search() }),
}));
vi.mock("../../../src/features/account/settled.client", () => ({
  useAccountSettled: () => signedIn,
}));
vi.mock("../../../src/app/readiness", () => ({
  preferencesReadiness: () => ({ state: () => ({ status: status() }) }),
}));
vi.mock("../../../src/ts/controllers/url-handler", () => ({
  applyUrlSettings: mocks.apply,
}));

import { mountApplication } from "../../../src/app/application";
import { useUrlSettings } from "../../../src/features/typing/url-settings.client";
import {
  createTestApplication,
  releaseTestApplication,
} from "../../__harness__/mock-application";

releaseTestApplication();
let dispose: () => void;
const [entered, setEntered] = createSignal(false);
function Probe(): null {
  useUrlSettings(entered);
  return null;
}
function navigate(value: string): void {
  window.history.replaceState(null, "", `/${value}`);
  setSearch(value);
}
beforeEach(() => {
  vi.clearAllMocks();
  const app = createTestApplication();
  const release = mountApplication(app.application);
  dispose = () => {
    release();
    app.dispose();
  };
  setSignedIn(undefined);
  setStatus("loading");
  setEntered(true);
  navigate("?testSettings=abc+d$");
});
afterEach(() => {
  cleanup();
  dispose();
  navigate("");
});

it("waits for entry, preferences and the account, then applies the raw URL once", () => {
  setEntered(false);
  render(() => <Probe />);
  setStatus("ready");
  setSignedIn(false);
  expect(mocks.apply).not.toHaveBeenCalled();
  setSignedIn(undefined);
  setEntered(true);
  expect(mocks.apply).not.toHaveBeenCalled();
  setSignedIn(false);
  expect(mocks.apply).toHaveBeenCalledExactlyOnceWith("?testSettings=abc+d$");
  // An unrelated session observation and a remount keep the applied search.
  setSignedIn(undefined);
  setSignedIn(false);
  cleanup();
  render(() => <Probe />);
  expect(mocks.apply).toHaveBeenCalledOnce();
});

it("does not reapply settings after sign-in", () => {
  render(() => <Probe />);
  setStatus("ready");
  setSignedIn(false);
  setSignedIn(undefined);
  setSignedIn(true);
  expect(mocks.apply).toHaveBeenCalledOnce();
  navigate("");
  expect(mocks.apply).toHaveBeenCalledOnce();
  navigate("?challenge=oneHourWarrior");
  expect(mocks.apply).toHaveBeenLastCalledWith("?challenge=oneHourWarrior");
});

it("ignores location changes for the route being navigated to", () => {
  render(() => <Probe />);
  setStatus("ready");
  setSignedIn(false);
  expect(mocks.apply).toHaveBeenCalledOnce();
  setPathname("/login");
  setSearch("");
  expect(mocks.apply).toHaveBeenCalledOnce();
  setPathname("/");
});

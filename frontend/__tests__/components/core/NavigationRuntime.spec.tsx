import { Router, useLocation } from "@solidjs/router";
import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const state = vi.hoisted(() => ({
  authAvailable: true,
  authenticated: false,
  restarting: false,
  calculating: false,
  transition: false,
  active: false,
  noQuit: false,
  change: vi.fn(async () => true),
  notice: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
}));

vi.mock("../../../src/ts/controllers/page-controller", () => ({
  change: state.change,
}));
vi.mock("../../../src/ts/auth-client", () => ({
  isAuthAvailable: () => state.authAvailable,
}));
vi.mock("../../../src/ts/states/core", () => ({
  isAuthenticated: () => state.authenticated,
}));
vi.mock("../../../src/ts/states/app", () => ({
  setAppLoading: state.loading,
}));
vi.mock("../../../src/ts/states/test", () => ({
  isTestRestarting: () => state.restarting,
  isResultCalculating: () => state.calculating,
  isTestActive: () => state.active,
}));
vi.mock("../../../src/ts/states/page-transition", () => ({
  get: () => state.transition,
}));
vi.mock("../../../src/features/typing/runtime/funbox/list", () => ({
  isFunboxActive: () => state.noQuit,
}));
vi.mock("../../../src/ts/states/notifications", () => ({
  showNoticeNotification: state.notice,
  showErrorNotification: state.error,
}));

import { Link } from "../../../src/ts/components/common/Link";
import { NavigationRuntime } from "../../../src/ts/components/core/NavigationRuntime";
import { authEvent } from "../../../src/ts/events/auth";
import { navigate, replaceUrl } from "../../../src/ts/navigation/navigation";
import { appRoutes } from "../../../src/ts/navigation/routes";

function mount(path = "/"): ReturnType<typeof render> {
  window.history.replaceState(window.history.state, "", path);
  return render(() => (
    <Router
      explicitLinks
      preload={false}
      root={(props) => {
        const location = useLocation();
        return (
          <>
            <NavigationRuntime />
            {props.children}
            <Link href="/settings">settings</Link>
            <output>
              {location.pathname + location.search + location.hash}
            </output>
          </>
        );
      }}
    >
      {appRoutes}
    </Router>
  ));
}

async function ready(): Promise<void> {
  authEvent.dispatch({
    type: "authStateChanged",
    data: {
      isUserSignedIn: state.authenticated,
      loadPromise: Promise.resolve(),
    },
  });
  await waitFor(() => expect(state.loading).toHaveBeenCalledWith(false));
}

describe("Solid Router page integration", () => {
  beforeEach(() => {
    Object.assign(state, {
      authAvailable: true,
      authenticated: false,
      restarting: false,
      calculating: false,
      transition: false,
      active: false,
      noQuit: false,
    });
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("waits for auth startup and passes loading options to the existing lifecycle", async () => {
    mount("/?mode=time#configuration");
    expect(state.change).not.toHaveBeenCalled();
    state.transition = true;
    await ready();
    expect(state.change).toHaveBeenCalledWith("test", {
      force: true,
      loadingOptions: expect.objectContaining({ style: "bar" }),
    });
    expect(window.location.href).toContain("/?mode=time#configuration");
  });

  it.each([
    ["/", "test"],
    ["/about", "about"],
    ["/settings/", "settings"],
    ["/leaderboards?type=daily", "leaderboards"],
    ["/profile", "profileSearch"],
    ["/unknown/path", "404"],
    ["/verify", "404"],
    ["/profile/name/extra", "404"],
  ])("matches %s to %s", async (path, page) => {
    mount(path);
    await ready();
    expect(state.change).toHaveBeenLastCalledWith(page, expect.any(Object));
  });

  it("preserves profile parameters and navigation data", async () => {
    mount();
    await ready();
    await navigate("/profile/some%20name", { data: { cached: true } });
    expect(state.change).toHaveBeenLastCalledWith("profile", {
      force: true,
      params: { uidOrName: "some%20name" },
      data: { cached: true },
    });
  });

  it.each(["/account", "/account-settings"])(
    "redirects signed-out %s visits to login without an extra history entry",
    async (path) => {
      mount();
      await ready();
      const length = window.history.length;
      await navigate(path);
      expect(window.location.pathname).toBe("/login");
      expect(window.history.length).toBe(length + 1);
      expect(state.change).toHaveBeenLastCalledWith("login", {});
    },
  );

  it("redirects authenticated login visits and allows protected pages", async () => {
    state.authenticated = true;
    mount("/login");
    await ready();
    expect(window.location.pathname).toBe("/account");
    await navigate("/account-settings");
    expect(window.location.pathname + window.location.search).toBe(
      "/settings?tab=account",
    );
    expect(state.change).toHaveBeenLastCalledWith("settings", {});
  });

  it.each([false, true])(
    "returns 404 for /friends with authenticated=%s",
    async (authenticated) => {
      state.authenticated = authenticated;
      mount("/friends");
      await ready();
      expect(state.change).toHaveBeenLastCalledWith(
        "404",
        expect.objectContaining({ force: true }),
      );
      expect(window.location.pathname).toBe("/friends");
    },
  );

  it("returns auth routes to the test when authentication is unavailable", async () => {
    state.authAvailable = false;
    mount("/account");
    await ready();
    expect(window.location.pathname).toBe("/");
    expect(state.change).toHaveBeenLastCalledWith("test", expect.any(Object));
  });

  it.each([
    "account",
    "authentication",
    "blockedUsers",
    "apeKeys",
    "dangerZone",
  ])(
    "redirects an initial legacy %s link while preserving query and hash",
    async (tab) => {
      state.authenticated = true;
      mount(`/account-settings/?tab=${tab}&highlight=details#security`);
      const length = window.history.length;
      await ready();
      expect(
        window.location.pathname +
          window.location.search +
          window.location.hash,
      ).toBe(`/settings?tab=${tab}&highlight=details#security`);
      expect(window.history.length).toBe(length);
      expect(state.change).toHaveBeenCalledOnce();
      expect(state.change).toHaveBeenLastCalledWith(
        "settings",
        expect.objectContaining({ force: true }),
      );
    },
  );

  it("replaces a legacy visit without adding redirect history and retains navigation options", async () => {
    state.authenticated = true;
    mount("/about");
    await ready();
    const length = window.history.length;
    await navigate("/account-settings?tab=apeKeys", {
      force: true,
      data: { source: "account" },
    });
    expect(window.location.pathname + window.location.search).toBe(
      "/settings?tab=apeKeys",
    );
    expect(window.history.length).toBe(length + 1);
    expect(state.change).toHaveBeenLastCalledWith("settings", {
      force: true,
      data: { source: "account" },
    });
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe("/about"));
    await waitFor(() =>
      expect(state.change).toHaveBeenLastCalledWith("about", {}),
    );
    window.history.forward();
    await waitFor(() =>
      expect(window.location.pathname + window.location.search).toBe(
        "/settings?tab=apeKeys",
      ),
    );
    await waitFor(() =>
      expect(state.change).toHaveBeenLastCalledWith("settings", {}),
    );
  });

  it.each(["restarting", "calculating", "transition"] as const)(
    "blocks navigation and history changes during %s",
    async (key) => {
      const { getByRole } = mount();
      await ready();
      state.change.mockClear();
      state[key] = true;
      await navigate("/settings");
      expect(state.change).not.toHaveBeenCalled();
      expect(getByRole("status")).toHaveTextContent("/");
      expect(window.location.pathname).toBe("/");
      await navigate("/settings", { force: true });
      expect(window.location.pathname).toBe("/settings");
    },
  );

  it("blocks active no-quit tests even with force", async () => {
    mount();
    await ready();
    state.active = state.noQuit = true;
    await navigate("/about", { force: true });
    expect(window.location.pathname).toBe("/");
    expect(state.notice).toHaveBeenCalledOnce();
  });

  it("blocks native links during an active no-quit test", async () => {
    const { getByRole } = mount();
    await ready();
    state.active = state.noQuit = true;
    fireEvent.click(getByRole("link", { name: "settings" }));
    expect(window.location.pathname).toBe("/");
    expect(state.notice).toHaveBeenCalledOnce();
  });

  it("does not give native clicks a pending forced navigation's bypass", async () => {
    const { getByRole } = mount();
    await ready();
    const navigation = navigate("/about", { force: true });
    fireEvent.click(getByRole("link", { name: "settings" }));
    await navigation;
    expect(window.location.pathname).toBe("/about");
    expect(state.change).toHaveBeenLastCalledWith("about", { force: true });
  });

  it("serializes forced refreshes after an unfinished page transition", async () => {
    mount();
    await ready();
    state.change.mockClear();
    let finish!: (value: boolean) => void;
    state.change.mockImplementationOnce(
      async () => new Promise<boolean>((resolve) => (finish = resolve)),
    );
    const first = navigate("/about");
    await waitFor(() => expect(state.change).toHaveBeenCalledOnce());
    const second = navigate("/settings", { force: true });
    await waitFor(() => expect(window.location.pathname).toBe("/settings"));
    expect(state.change).toHaveBeenCalledOnce();
    finish(true);
    await Promise.all([first, second]);
    expect(state.change).toHaveBeenLastCalledWith("settings", { force: true });
  });

  it("rejects failed page lifecycles and permits later navigation", async () => {
    mount();
    await ready();
    state.change.mockRejectedValueOnce(new Error("page failed"));
    await expect(navigate("/about")).rejects.toThrow("page failed");
    await navigate("/settings");
    expect(state.change).toHaveBeenLastCalledWith("settings", {});
  });

  it("waits for page transitions and reloads the current URL without pushing history", async () => {
    mount();
    await ready();
    let finish!: (value: boolean) => void;
    state.change.mockImplementationOnce(
      async () => new Promise<boolean>((resolve) => (finish = resolve)),
    );
    const finished = vi.fn();
    const navigation = navigate("/about").then(finished);
    await waitFor(() => expect(window.location.pathname).toBe("/about"));
    expect(finished).not.toHaveBeenCalled();
    finish(true);
    await navigation;
    const length = window.history.length;
    await navigate(undefined, { force: true });
    expect(window.history.length).toBe(length);
    expect(state.change).toHaveBeenLastCalledWith("about", { force: true });
  });

  it("routes browser back/forward through the lifecycle", async () => {
    const { getByRole } = mount();
    await ready();
    await navigate("/settings?highlight=fontSize");
    await waitFor(() => expect(window.location.pathname).toBe("/settings"));
    await navigate("/about");
    window.history.back();
    await waitFor(() =>
      expect(getByRole("status")).toHaveTextContent(
        "/settings?highlight=fontSize",
      ),
    );
    await waitFor(() =>
      expect(state.change).toHaveBeenLastCalledWith("settings", {}),
    );
    window.history.forward();
    await waitFor(() =>
      expect(getByRole("status")).toHaveTextContent("/about"),
    );
    await waitFor(() =>
      expect(state.change).toHaveBeenLastCalledWith("about", {}),
    );
  });

  it("restores the URL when browser back is blocked", async () => {
    const { getByRole } = mount();
    await ready();
    await navigate("/about");
    state.change.mockClear();
    state.active = state.noQuit = true;
    window.history.back();
    await waitFor(() => expect(state.notice).toHaveBeenCalledOnce());
    await waitFor(() => expect(window.location.pathname).toBe("/about"));
    expect(getByRole("status")).toHaveTextContent("/about");
    expect(state.change).not.toHaveBeenCalled();
  });

  it("replaces query state in the router while busy without pushing history", async () => {
    const { getByRole } = mount("/settings");
    await ready();
    state.transition = true;
    const length = window.history.length;
    state.change.mockClear();
    await replaceUrl("/settings?highlight=fontSize#details");
    await waitFor(() =>
      expect(getByRole("status")).toHaveTextContent(
        "/settings?highlight=fontSize#details",
      ),
    );
    expect(window.history.length).toBe(length);
    expect(state.change).not.toHaveBeenCalled();
    await navigate(undefined, { force: true });
    expect(window.location.search).toBe("?highlight=fontSize");
  });

  it("unsubscribes events and unbinds imperative navigation on disposal", async () => {
    const { unmount } = mount();
    await ready();
    state.change.mockClear();
    unmount();
    authEvent.dispatch({
      type: "authStateChanged",
      data: { isUserSignedIn: false, loadPromise: Promise.resolve() },
    });
    await expect(navigate("/about")).rejects.toThrow(
      "App router is not mounted",
    );
    expect(state.change).not.toHaveBeenCalled();
  });
});

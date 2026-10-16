import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import {
  type AnyRoute,
  type AnyRouter,
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "@tanstack/solid-router";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const state = vi.hoisted(() => ({
  restarting: false,
  calculating: false,
  active: false,
  noQuit: false,
  notice: vi.fn(),
}));

vi.mock("../../src/ts/states/test", () => ({
  isTestRestarting: () => state.restarting,
  isResultCalculating: () => state.calculating,
  isTestActive: () => state.active,
}));
vi.mock("../../src/ts/test/funbox/list", () => ({
  isFunboxActive: () => state.noQuit,
}));
vi.mock("../../src/ts/states/notifications", () => ({
  showNoticeNotification: state.notice,
}));

import {
  navigationHref,
  RouterNavigation,
} from "../../src/app/navigation.client";
import { LinkHost, RouterLink } from "../../src/components/link-host";
import { Button } from "../../src/ts/components/common/Button";
import { Link } from "../../src/ts/components/common/Link";
import { navigate, replaceUrl } from "../../src/ts/navigation/navigation";

function mount(
  path = "/",
  aboutLoader?: () => Promise<void>,
  suppliedHistory?: ReturnType<typeof createMemoryHistory>,
): ReturnType<typeof render> & {
  router: AnyRouter;
  history: ReturnType<typeof createMemoryHistory>;
} {
  const root = createRootRoute({
    component: () => {
      const location = useLocation();
      return (
        <LinkHost.Provider value={RouterLink}>
          <RouterNavigation />
          <Link href="/about">about</Link>
          <Button href="/settings?tab=account" router-link text="settings" />
          <Link href="/about" download="file.txt">
            download
          </Link>
          <output>{location().href}</output>
          <Outlet />
        </LinkHost.Provider>
      );
    },
  });
  const page = (route: string): AnyRoute =>
    createRoute({
      getParentRoute: () => root,
      path: route,
      loader: route === "/about" ? aboutLoader : undefined,
    });
  const history =
    suppliedHistory ?? createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({
    routeTree: root.addChildren([
      page("/"),
      page("/about"),
      page("/settings"),
      page("/leaderboards"),
    ]),
    history,
  });
  const result = render(() => <RouterProvider router={router} />);
  return { ...result, router, history };
}

describe("Router-owned navigation", () => {
  beforeEach(() => {
    Object.assign(state, {
      restarting: false,
      calculating: false,
      active: false,
      noQuit: false,
    });
    state.notice.mockClear();
  });
  afterEach(cleanup);

  it("routes shared links and router-marked buttons through the Router", async () => {
    const { findByRole, getByText, router } = mount();
    await findByRole("status");
    fireEvent.click(getByText("about"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/about"));
    fireEvent.click(getByText("settings"));
    await waitFor(() =>
      expect(router.state.location.href).toBe("/settings?tab=account"),
    );
    expect(getByText("about")).not.toHaveClass("active");
  });

  it("leaves modified clicks and downloads native", async () => {
    const { findByRole, getByText, router } = mount();
    await findByRole("status");
    const modified = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    fireEvent(getByText("about"), modified);
    expect(modified.defaultPrevented).toBe(false);
    expect(getByText("download")).toHaveAttribute("download", "file.txt");
    expect(router.state.location.pathname).toBe("/");
  });

  it("blocks link navigation while a result is calculating", async () => {
    const { findByRole, getByText, router } = mount();
    await findByRole("status");
    state.calculating = true;
    fireEvent.click(getByText("about"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(router.state.location.pathname).toBe("/");
    state.calculating = false;
    fireEvent.click(getByText("about"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/about"));
  });

  it("lets forced imperative navigation skip restart checks but never no_quit", async () => {
    const { findByRole, router } = mount();
    await findByRole("status");
    state.restarting = true;
    await navigate("/about");
    expect(router.state.location.pathname).toBe("/");
    await navigate("/about", { force: true });
    expect(router.state.location.pathname).toBe("/about");
    state.restarting = false;
    state.active = state.noQuit = true;
    await navigate("/leaderboards", { force: true });
    expect(router.state.location.pathname).toBe("/about");
    expect(state.notice).toHaveBeenCalledWith(
      "No quit funbox is active. Please finish the test.",
      { important: true },
    );
  });

  it("replaces search without pushing history", async () => {
    const { findByRole, router, history } = mount("/about");
    await findByRole("status");
    await navigate("/leaderboards/");
    expect(router.state.location.pathname).toBe("/leaderboards");
    await replaceUrl("/leaderboards?page=2");
    expect(router.state.location.href).toBe("/leaderboards?page=2");
    history.back();
    await waitFor(() => expect(router.state.location.pathname).toBe("/about"));
  });

  it("blocks browser history traversal during no_quit, then restores back/forward", async () => {
    // Memory history deliberately skips POP blockers in this pinned version.
    window.history.replaceState(null, "", "/settings");
    const history = createBrowserHistory();
    try {
      const { findByRole, router } = mount("/settings", undefined, history);
      await findByRole("status");
      await navigate("/about");
      state.active = state.noQuit = true;
      history.back();
      await waitFor(() => expect(state.notice).toHaveBeenCalled());
      expect(router.state.location.pathname).toBe("/about");
      state.active = false;
      history.back();
      await waitFor(() =>
        expect(router.state.location.pathname).toBe("/settings"),
      );
      history.forward();
      await waitFor(() =>
        expect(router.state.location.pathname).toBe("/about"),
      );
    } finally {
      cleanup();
      history.destroy();
    }
  });

  it("settles rapid imperative navigation at the latest target without waiting for an abandoned loader", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loader = vi.fn(async () => await pending);
    const { findByRole, router } = mount("/", loader);
    await findByRole("status");
    const first = navigate("/about");
    await waitFor(() => expect(loader).toHaveBeenCalled());
    const last = navigate("/settings");
    await Promise.all([first, last]);
    expect(router.state.location.pathname).toBe("/settings");
    release();
    await pending;
    expect(router.state.location.pathname).toBe("/settings");
  });

  it("only confirms document exit when the test guard blocks navigation", async () => {
    const history = createBrowserHistory();
    try {
      const { findByRole } = mount("/", undefined, history);
      await findByRole("status");
      const allowed = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(allowed);
      expect(allowed.defaultPrevented).toBe(false);
      state.active = state.noQuit = true;
      const blocked = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(blocked);
      expect(blocked.defaultPrevented).toBe(true);
    } finally {
      cleanup();
      history.destroy();
    }
  });

  it("normalizes imperative URLs and rejects other origins", () => {
    expect(navigationHref("")).toBe("/");
    expect(navigationHref("/profile/a/?x=1#h")).toBe("/profile/a?x=1#h");
    expect(navigationHref(`${window.location.origin}/about`)).toBe("/about");
    expect(() => navigationHref("https://example.com/about")).toThrow(
      "same-origin",
    );
  });
});

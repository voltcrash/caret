import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { AnimationParams } from "animejs";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { animations, mounts, aboutStats } = vi.hoisted(() => ({
  animations: [] as { element: HTMLElement; params: AnimationParams }[],
  mounts: { settings: vi.fn(), about: vi.fn() },
  aboutStats: Promise.withResolvers<string>(),
}));
vi.mock("animejs", () => ({
  animate: (element: HTMLElement, params: AnimationParams) => {
    animations.push({ element, params });
    return { cancel: vi.fn() };
  },
}));
vi.mock("../../../src/ts/components/pages/404Page", () => ({
  NotFoundPage: () => <div />,
}));
vi.mock("../../../src/ts/components/pages/AboutPage", async () => {
  const { createResource } = await import("solid-js");
  return {
    AboutPage: () => {
      mounts.about();
      const [stats] = createResource(async () => await aboutStats.promise);
      return (
        <div>
          <h2>About</h2>
          <span>{stats()}</span>
        </div>
      );
    },
  };
});
vi.mock("../../../src/ts/components/pages/account/AccountPage", () => ({
  AccountPage: () => <div />,
}));
vi.mock("../../../src/ts/components/pages/leaderboard/LeaderboardPage", () => ({
  LeaderboardPage: () => <div />,
}));
vi.mock("../../../src/ts/components/pages/LoadingPage", () => ({
  LoadingPage: () => <div />,
}));
vi.mock("../../../src/ts/components/pages/login/LoginPage", () => ({
  LoginPage: () => <div />,
}));
vi.mock("../../../src/ts/components/pages/profile/ProfilePage", () => ({
  ProfilePage: () => <div />,
}));
vi.mock("../../../src/ts/components/pages/profile/ProfileSearchPage", () => ({
  ProfileSearchPage: () => <div />,
}));
vi.mock("../../../src/ts/components/pages/settings/SettingsPage", () => ({
  SettingsPage: () => {
    mounts.settings();
    return <input aria-label="setting" />;
  },
}));
vi.mock("../../../src/features/typing/components/TestPage", () => ({
  TestPage: (props: { ref: (el: HTMLDivElement) => void }) => (
    <div ref={props.ref} class="pageTest">
      <textarea />
    </div>
  ),
}));

import { AppPages } from "../../../src/ts/components/pages/AppPages";
import {
  activatePage,
  getPageView,
  preparePage,
  transitionPage,
} from "../../../src/ts/states/page-transition";

afterEach(() => {
  cleanup();
  animations.length = 0;
  vi.clearAllMocks();
  activatePage("loading");
});

function completeAnimation(): void {
  // @ts-expect-error animation callback arguments unused by the page transition
  animations.at(-1)?.params.onComplete?.();
}

describe("AppPages", () => {
  it("shows page content while its own data queries are pending", async () => {
    activatePage("about");
    const { findByText } = render(() => <AppPages />);
    expect(await findByText("About")).toBeVisible();
  });
  it("mounts optional pages on first visit and retains their owners", async () => {
    activatePage("loading");
    const { container } = render(() => <AppPages />);
    expect(mounts.settings).not.toHaveBeenCalled();
    expect(mounts.about).not.toHaveBeenCalled();
    activatePage("settings");
    await waitFor(() => expect(mounts.settings).toHaveBeenCalledOnce());
    const input = container.querySelector("input");
    activatePage("test");
    activatePage("settings");
    expect(container.querySelector("input")).toBe(input);
    expect(mounts.settings).toHaveBeenCalledOnce();
    expect(mounts.about).not.toHaveBeenCalled();
  });
  it("retains the outgoing page until its fade completes", async () => {
    activatePage("settings");
    const { container } = render(() => <AppPages />);
    const outgoing = container.querySelector("#pageSettings");
    const done = transitionPage("settings", false, 125);
    expect(container.querySelector("#pageSettings")).toBe(outgoing);
    expect(outgoing).not.toHaveClass("active");
    expect(animations.at(-1)?.params["opacity"]).toEqual([1, 0]);
    completeAnimation();
    await done;
    expect(container.querySelector("#pageSettings")).toBeNull();
  });

  it("prepares hidden pages for lifecycle hooks and activates after fading in", async () => {
    const { container } = render(() => <AppPages />);
    preparePage("settings");
    expect(container.querySelector("#pageSettings")).toHaveClass("hidden");
    const done = transitionPage("settings", true, 125);
    expect(container.querySelector("#pageSettings")).not.toHaveClass("hidden");
    expect(animations.at(-1)?.params["opacity"]).toEqual([0, 1]);
    completeAnimation();
    await done;
    expect(container.querySelector("#pageSettings")).toHaveClass("active");
    expect(getPageView().phase).toBe("active");
  });

  it("reattaches the same test textarea across navigation", () => {
    activatePage("test");
    const { container } = render(() => <AppPages />);
    const input = container.querySelector("textarea");
    activatePage("settings");
    expect(container.querySelector("textarea")).toBeNull();
    activatePage("test");
    expect(container.querySelector("textarea")).toBe(input);
  });
});

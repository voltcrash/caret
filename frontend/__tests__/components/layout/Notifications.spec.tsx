import { cleanup, render } from "@solidjs/testing-library";
import { ParentProps, Show } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

vi.mock("../../../src/ts/components/common/anime/Anime", () => ({
  Anime: (props: ParentProps) => <div>{props.children}</div>,
}));
vi.mock("../../../src/ts/components/common/anime/AnimePresence", () => ({
  AnimePresence: (props: ParentProps) => <>{props.children}</>,
}));
vi.mock("../../../src/ts/components/common/anime/AnimeShow", () => ({
  AnimeShow: (props: ParentProps<{ when: boolean }>) => (
    <Show when={props.when}>{props.children}</Show>
  ),
}));
vi.mock("../../../src/ts/states/core", () => ({
  getGlobalOffsetTop: () => 0,
  getIsScreenshotting: () => false,
}));
vi.mock("../../../src/ts/states/test", () => ({ getFocus: () => false }));

import { Notifications } from "../../../src/ts/components/layout/overlays/Notifications";
import {
  clearAllNotifications,
  showNoticeNotification,
} from "../../../src/ts/states/notifications";

beforeEach(() => {
  clearAllNotifications();
});
afterEach(() => {
  cleanup();
  clearAllNotifications();
});

it("renders structured notification lines as text", () => {
  const lines = ["<script>alert(1)</script>", "", '<img onerror="alert(1)">'];
  showNoticeNotification(lines, { durationMs: 0 });
  const view = render(() => <Notifications />);
  expect(view.container.textContent).toContain(lines[0]);
  expect(view.container.textContent).toContain(lines[2]);
  expect(view.container.querySelectorAll("br")).toHaveLength(2);
  expect(view.container.querySelector("script, img")).toBeNull();
});

it.each(["<script>alert(1)</script>", '<img src="x" onerror="alert(1)">'])(
  "renders notification input as text: %s",
  (message) => {
    showNoticeNotification(message, { durationMs: 0 });
    const view = render(() => <Notifications />);
    expect(view.container.textContent).toContain(message);
    expect(view.container.querySelector("script, img")).toBeNull();
  },
);

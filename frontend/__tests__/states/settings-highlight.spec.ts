import { afterEach, expect, it, vi } from "vite-plus/test";
import {
  highlightSetting,
  registerSettingHighlight,
} from "../../src/ts/states/settings-highlight";

afterEach(() => highlightSetting(null));

it("keeps highlights pending until account controls mount", () => {
  const highlight = vi.fn();
  highlightSetting("account-only");
  const release = registerSettingHighlight("account-only", highlight);
  expect(highlight).toHaveBeenCalledOnce();
  release();
  const remounted = vi.fn();
  registerSettingHighlight("account-only", remounted)();
  expect(remounted).not.toHaveBeenCalled();
});

it("cancels pending highlights when the route leaves or the target changes", () => {
  highlightSetting("old-target");
  highlightSetting("new-target");
  const old = vi.fn();
  registerSettingHighlight("old-target", old)();
  expect(old).not.toHaveBeenCalled();
  highlightSetting(null);
  const next = vi.fn();
  registerSettingHighlight("new-target", next)();
  expect(next).not.toHaveBeenCalled();
});

it("highlights mounted local settings immediately and unregisters disposed refs", () => {
  const highlight = vi.fn();
  const release = registerSettingHighlight("local", highlight);
  highlightSetting("local");
  expect(highlight).toHaveBeenCalledOnce();
  release();
  highlightSetting("local");
  expect(highlight).toHaveBeenCalledOnce();
});

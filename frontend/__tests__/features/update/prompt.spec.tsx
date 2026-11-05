import { resetTypingLifecycle } from "../../__harness__/typing-lifecycle";
vi.mock("../../../src/ts/utils/env", () => ({ isDevEnvironment: () => false }));
import { cleanup, render, screen } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { reportStaleClient } from "../../../src/app/release";
import { trackResultSave } from "../../../src/app/update-safety";
import { UpdateRuntime } from "../../../src/features/update/runtime.client";
import { getBanners, removeBanner } from "../../../src/ts/states/banners";
import { getNotifications } from "../../../src/ts/states/notifications";

/** The banner overlay is not mounted here; render the banner's content. */
function reloadButton(): HTMLButtonElement {
  cleanupBanner?.();
  const view = render(() => <>{getBanners()[0]?.customContent}</>);
  cleanupBanner = view.unmount;
  return screen.getByRole("button", { name: "Reload" });
}
let cleanupBanner: (() => void) | undefined;

describe("update prompt", () => {
  beforeEach(() => {
    resetTypingLifecycle();
  });
  afterEach(() => {
    cleanup();
    cleanupBanner?.();
    for (const banner of [...getBanners()]) removeBanner(banner.id);
  });

  it("prompts after a stale function, refusing to reload mid-test or mid-save", async () => {
    const reload = vi.fn();
    render(() => <UpdateRuntime reload={reload} />);
    resetTypingLifecycle("running");
    reportStaleClient("function");
    expect(getBanners()).toHaveLength(0);
    resetTypingLifecycle();
    expect(getBanners()).toHaveLength(1);
    expect(getBanners()[0]?.level).toBe("error");
    expect(getBanners()[0]?.important).toBe(true);

    resetTypingLifecycle("running");
    reloadButton().click();
    expect(reload).not.toHaveBeenCalled();
    expect(getNotifications().at(-1)?.message).toContain("Finish the test");

    resetTypingLifecycle();
    let finish!: () => void;
    const save = trackResultSave(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    reloadButton().click();
    expect(reload).not.toHaveBeenCalled();
    finish();
    await save;

    reloadButton().click();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

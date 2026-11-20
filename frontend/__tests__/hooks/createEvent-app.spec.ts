import { expect, it, vi } from "vite-plus/test";

import { mountApplication } from "../../src/app/application";
import { createEvent } from "../../src/ts/hooks/createEvent";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/test-application";

it("keeps listeners with the app they subscribed in", () => {
  const event = createEvent<string>();
  const listener = vi.fn();
  event.subscribe(listener);
  releaseTestApplication();

  event.dispatch("unmounted");
  const next = createTestApplication();
  const release = mountApplication(next.application);
  try {
    event.dispatch("next app");
    expect(event.hasListeners()).toBe(false);
  } finally {
    release();
    next.dispose();
  }
  expect(listener).not.toHaveBeenCalled();
});

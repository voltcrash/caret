import { QueryClient } from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  onCleanup,
} from "solid-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  type Application,
  createAppMemo,
  createAppOwned,
  currentApplication,
  mountApplication,
  requireApplication,
} from "../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/mock-application";

releaseTestApplication();

const releases: (() => void)[] = [];
afterEach(() => {
  for (const release of releases.splice(0)) release();
});

function create(): Application {
  const { application, dispose } = createTestApplication();
  releases.push(dispose);
  return application;
}

function mount(): Application {
  const application = create();
  releases.unshift(mountApplication(application));
  return application;
}

describe("browser application owner", () => {
  it("is absent until mounted and after release", () => {
    expect(currentApplication()).toBeUndefined();
    expect(() => requireApplication()).toThrow("No Oxytype application");
    const application = mount();
    expect(requireApplication()).toBe(application);
    releases.shift()?.();
    expect(currentApplication()).toBeUndefined();
  });

  it("refuses a second concurrent application", () => {
    mount();
    expect(() => mountApplication(create())).toThrow("already mounted");
  });

  it("ignores a stale release after a newer mount", () => {
    const release = mountApplication(create());
    release();
    const next = mount();
    release();
    expect(currentApplication()).toBe(next);
  });

  it("notifies reactive readers of mount changes", () => {
    const seen: (QueryClient | undefined)[] = [];
    const dispose = createRoot((dispose) => {
      createEffect(() => seen.push(currentApplication()?.queryClient));
      return dispose;
    });
    const application = mount();
    releases.shift()?.();
    dispose();
    expect(seen).toEqual([undefined, application.queryClient, undefined]);
  });

  it("creates owned values once per application and disposes them with it", () => {
    let created = 0;
    let cleaned = 0;
    const [source, setSource] = createSignal(1);
    const owned = createAppOwned(() => {
      created++;
      onCleanup(() => cleaned++);
      return createMemo(() => source() * 2);
    });
    const doubled = createAppMemo(() => source() * 2);
    mount();
    expect(owned()()).toBe(2);
    expect(owned()()).toBe(2);
    expect(doubled()).toBe(2);
    setSource(2);
    expect(doubled()).toBe(4);
    expect(created).toBe(1);
    for (const release of releases.splice(0)) release();
    expect(cleaned).toBe(1);
    mount();
    expect(owned()()).toBe(4);
    expect(created).toBe(2);
  });
});

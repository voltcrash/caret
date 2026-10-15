import { QueryClient } from "@tanstack/solid-query";
import { createRoot, createEffect } from "solid-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createAccountDataOwner } from "../../src/app/account-data";
import {
  type Application,
  currentApplication,
  mountApplication,
  requireApplication,
} from "../../src/app/application";
import { releaseTestApplication } from "../__harness__/mock-application";

releaseTestApplication();

const releases: (() => void)[] = [];
afterEach(() => {
  for (const release of releases.splice(0)) release();
});

function create(): Application {
  return {
    queryClient: new QueryClient(),
    accountData: createAccountDataOwner(),
  };
}

function mount(): Application {
  const application = create();
  releases.push(mountApplication(application));
  return application;
}

describe("browser application owner", () => {
  it("is absent until mounted and after release", () => {
    expect(currentApplication()).toBeUndefined();
    expect(() => requireApplication()).toThrow("No Oxytype application");
    const application = mount();
    expect(requireApplication()).toBe(application);
    releases.pop()?.();
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
    releases.pop()?.();
    dispose();
    expect(seen).toEqual([undefined, application.queryClient, undefined]);
  });
});

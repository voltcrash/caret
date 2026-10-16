import { describe, expect, it, vi } from "vite-plus/test";

import { registerServiceWorker } from "../../../src/features/update/service-worker.client";
import { skipWaitingMessage } from "../../../src/sw/policy";

class FakeTarget extends EventTarget {}

type Waiting = { postMessage: ReturnType<typeof vi.fn> };
type Fixture = {
  registration: FakeTarget & {
    installing: (EventTarget & { state: string }) | null;
    waiting: Waiting | null;
    update: ReturnType<typeof vi.fn>;
  };
  container: FakeTarget & { register: ReturnType<typeof vi.fn> };
  onWaiting: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
  updates: ReturnType<typeof registerServiceWorker>;
};

function fixture(initialWaiting = false): Fixture {
  const registration = Object.assign(new FakeTarget(), {
    installing: null as (EventTarget & { state: string }) | null,
    waiting: initialWaiting
      ? { postMessage: vi.fn() }
      : (null as Waiting | null),
    update: vi.fn(async () => undefined),
  });
  const container = Object.assign(new FakeTarget(), {
    register: vi.fn(async () => registration),
  });
  const onWaiting = vi.fn();
  const reload = vi.fn();
  const updates = registerServiceWorker({
    container: container as unknown as ServiceWorkerContainer,
    onWaiting,
    reload,
    isSafe: () => true,
  });
  return { registration, container, onWaiting, reload, updates };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("service-worker registration", () => {
  it("registers the root worker without HTTP-cached scripts", async () => {
    const { container } = fixture();
    await settle();
    expect(container.register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });

  it("reports an already waiting worker but never activates it by itself", async () => {
    const { registration, onWaiting } = fixture(true);
    await settle();
    expect(onWaiting).toHaveBeenLastCalledWith(true);
    expect(registration.waiting?.postMessage).not.toHaveBeenCalled();
  });

  it("reports a newly installed worker once it is waiting", async () => {
    const { registration, onWaiting } = fixture();
    await settle();
    const installing = Object.assign(new FakeTarget(), { state: "installing" });
    registration.installing = installing;
    registration.dispatchEvent(new Event("updatefound"));
    registration.waiting = { postMessage: vi.fn() };
    installing.state = "installed";
    installing.dispatchEvent(new Event("statechange"));
    expect(onWaiting).toHaveBeenLastCalledWith(true);
  });

  it("activates silently, or reloads only after a requested takeover", async () => {
    const { registration, container, reload, updates } = fixture(true);
    await settle();
    const waiting = registration.waiting;
    expect(updates.activateWaiting(false)).toBe(true);
    expect(waiting?.postMessage).toHaveBeenCalledWith(skipWaitingMessage);
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).not.toHaveBeenCalled();
    registration.waiting = { postMessage: vi.fn() };
    expect(updates.activateWaiting(true)).toBe(true);
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("has nothing to activate without a waiting worker", async () => {
    const { updates, reload } = fixture();
    await settle();
    expect(updates.activateWaiting(true)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("stops reacting after disposal", async () => {
    const { container, reload, updates, registration } = fixture(true);
    await settle();
    updates.activateWaiting(true);
    updates.dispose();
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).not.toHaveBeenCalled();
    expect(registration.update).not.toHaveBeenCalled();
  });
});

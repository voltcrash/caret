import { skipWaitingMessage, updateSafetyRequest, workerBuildRequest } from "../../sw/policy";

export type ServiceWorkerUpdates = {
  waitingBuild: () => Promise<string | undefined>;
  /** Lets a waiting worker take over; reloads afterwards when asked to. */
  activateWaiting: (reload: boolean) => boolean;
  /** Asks the browser to look for a new `/sw.js`. */
  check: () => void;
  dispose: () => void;
};

/**
 * Registers `/sw.js` and reports a waiting worker. Nothing activates or reloads
 * by itself: the caller decides when it is safe (never mid-test or mid-save).
 * Rollback/first installs activate inside the worker, as before.
 */
export function registerServiceWorker(options: {
  container: ServiceWorkerContainer;
  onWaiting: (waiting: boolean) => void;
  reload: () => void;
  isSafe: () => boolean;
}): ServiceWorkerUpdates {
  const { container } = options;
  let registration: ServiceWorkerRegistration | undefined;
  let reloadRequested = false;
  let disposed = false;
  const watched = new Set<ServiceWorker>();
  const requests = new Set<() => void>();
  const report = (): void => {
    if (!disposed) options.onWaiting((registration?.waiting ?? null) !== null);
  };
  const watch = (worker: ServiceWorker | null): void => {
    if (worker !== null) watched.add(worker);
    worker?.addEventListener("statechange", report);
  };
  const onUpdateFound = (): void => watch(registration?.installing ?? null);
  const onControllerChange = (): void => {
    report();
    if (reloadRequested && !disposed) options.reload();
  };
  container.addEventListener("controllerchange", onControllerChange);
  const onMessage = (event: MessageEvent): void => {
    if (event.data === updateSafetyRequest) {
      event.ports[0]?.postMessage(!disposed && options.isSafe());
    }
  };
  container.addEventListener("message", onMessage);
  void container
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((registered) => {
      registration = registered;
      if (disposed) return;
      registered.addEventListener("updatefound", onUpdateFound);
      watch(registered.installing);
      report();
    })
    .catch((error: unknown) => {
      console.error("ServiceWorker registration failed", error);
    });
  return {
    waitingBuild: async () => {
      const waiting = registration?.waiting;
      if (disposed || !waiting) return undefined;
      return await new Promise<string | undefined>((resolve) => {
        const channel = new MessageChannel();
        const finish = (build?: string): void => {
          clearTimeout(timer);
          channel.port1.close();
          requests.delete(cancel);
          resolve(!disposed && registration?.waiting === waiting ? build : undefined);
        };
        const cancel = (): void => finish();
        const timer = setTimeout(cancel, 1000);
        requests.add(cancel);
        channel.port1.onmessage = (event: MessageEvent<unknown>) => finish(typeof event.data === "string" ? event.data : undefined);
        waiting.postMessage(workerBuildRequest, [channel.port2]);
      });
    },
    activateWaiting: (reload) => {
      const waiting = registration?.waiting ?? null;
      if (waiting === null) return false;
      reloadRequested ||= reload;
      waiting.postMessage(skipWaitingMessage);
      return true;
    },
    check: () => {
      void registration?.update().catch(() => undefined);
    },
    dispose: () => {
      disposed = true;
      for (const cancel of requests) cancel();
      container.removeEventListener("controllerchange", onControllerChange);
      container.removeEventListener("message", onMessage);
      registration?.removeEventListener("updatefound", onUpdateFound);
      for (const worker of watched) {
        worker.removeEventListener("statechange", report);
      }
      watched.clear();
    },
  };
}

/** Development never keeps a worker. */
export async function unregisterServiceWorkers(
  container: ServiceWorkerContainer,
): Promise<void> {
  const registrations = await container.getRegistrations();
  await Promise.all(registrations.map(async (r) => await r.unregister()));
}

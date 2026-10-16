import { skipWaitingMessage, updateSafetyRequest } from "../../sw/policy";

export type ServiceWorkerUpdates = {
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

/** Development never keeps a worker; matches the rollback behaviour. */
export async function unregisterServiceWorkers(
  container: ServiceWorkerContainer,
): Promise<void> {
  const registrations = await container.getRegistrations();
  await Promise.all(registrations.map(async (r) => await r.unregister()));
}

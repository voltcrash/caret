import { describe, expect, it, vi } from "vite-plus/test";
import { createLifecycleController } from "../../../src/features/typing/lifecycle-controller";
import {
  initialLifecycle,
  transitionLifecycle,
} from "../../../src/features/typing/lifecycle-machine";

function ready(): ReturnType<typeof createLifecycleController> {
  const controller = createLifecycleController();
  for (const type of [
    "MOUNT",
    "RESTART",
    "EXIT_DONE",
    "PREPARED",
    "ENTER_DONE",
  ] as const) {
    expect(controller.send({ type })).toBe(true);
  }
  return controller;
}

describe("typing lifecycle transitions", () => {
  it("rejects input and completion until preparation finishes", () => {
    const controller = createLifecycleController();
    for (const type of [
      "START",
      "FINISH",
      "PREPARED",
      "PRESENTED",
      "RETRY",
    ] as const) {
      expect(controller.send({ type })).toBe(false);
      expect(controller.state()).toEqual(initialLifecycle());
    }
  });

  it("accepts one start and finish, then presents a result", () => {
    const controller = ready();
    expect(controller.send({ type: "START" })).toBe(true);
    expect(controller.send({ type: "START" })).toBe(false);
    expect(controller.send({ type: "FINISH" })).toBe(true);
    expect(controller.send({ type: "FINISH" })).toBe(false);
    expect(controller.send({ type: "RESTART" })).toBe(false);
    for (const type of [
      "STOPPED",
      "WORDS_HIDDEN",
      "COMPLETION_LOADED",
      "RESULT_BUILT",
      "RESULT_READY",
      "PRESENTED",
    ] as const) {
      expect(controller.send({ type })).toBe(true);
    }
    expect(controller.state().phase).toBe("result");
  });

  it("rejects replies from a prior restart and prior mount", () => {
    const controller = ready();
    const old = controller.capture();
    controller.send({ type: "RESTART" });
    expect(old.isCurrent()).toBe(false);
    expect(old.send("PREPARED")).toBe(false);
    controller.send({ type: "UNMOUNT" });
    controller.send({ type: "MOUNT" });
    expect(old.send("ENTER_DONE")).toBe(false);
    expect(controller.state().phase).toBe("waitingPreferences");
  });

  it("retries only the failed completion phase and invalidates its old replies", async () => {
    const controller = ready();
    for (const type of [
      "START",
      "FINISH",
      "STOPPED",
      "COMPLETION_LOADED",
      "RESULT_BUILT",
    ] as const) {
      controller.send({ type });
    }
    const stale = controller.capture();
    controller.send({ type: "FAIL", error: new Error("chart failed") });
    expect(controller.state().phase).toBe("error.completion");
    const retry = vi.fn(async () => undefined);
    controller.recoverWith(retry);
    await controller.retry();
    expect(retry).toHaveBeenCalledOnce();
    expect(controller.state().phase).toBe("completing.presenting");
    expect(stale.send("RESULT_READY")).toBe(false);
  });

  it("cancels an in-flight wait on unmount", async () => {
    const controller = ready();
    const pending = controller
      .capture()
      .wait(new Promise<void>(() => undefined));
    const cancelled = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.send({ type: "UNMOUNT" });
    await cancelled;
  });

  it("bounds a pending operation and clears its timer", async () => {
    vi.useFakeTimers();
    try {
      const controller = ready();
      const pending = controller
        .capture()
        .wait(new Promise<void>(() => undefined), 50);
      const expired = expect(pending).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(50);
      await expired;
      controller.send({ type: "FAIL", error: new Error("timeout") });
      expect(controller.state().phase).toBe("error.preparation");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("makes disposal terminal", () => {
    const disposed = transitionLifecycle(initialLifecycle(), {
      type: "DISPOSE",
    });
    for (const type of ["MOUNT", "RESTART", "UNMOUNT", "START"] as const) {
      expect(transitionLifecycle(disposed, { type })).toBe(disposed);
    }
  });

  it("escalates a recoverable completion error when the engine becomes fatal", () => {
    const controller = ready();
    controller.send({ type: "START" });
    controller.send({ type: "FINISH" });
    controller.send({ type: "FAIL", error: new Error("snapshot failed") });
    controller.send({ type: "FATAL", error: new Error("engine crashed") });
    expect(controller.state().phase).toBe("error.fatal");
    expect(controller.send({ type: "RETRY" })).toBe(false);
    expect(controller.send({ type: "RESTART" })).toBe(false);
    controller.send({ type: "UNMOUNT" });
    expect(controller.state().phase).toBe("unmounted");
  });
});

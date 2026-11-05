import { createRoot } from "solid-js";
import { expect, it } from "vite-plus/test";

import { createReadiness } from "../../src/app/readiness";

it("retries failed startup work without retaining its rejected promise", async () => {
  const { readiness, dispose } = createRoot((dispose) => ({ readiness: createReadiness(), dispose }));
  try {
    await expect(readiness.start(async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(readiness.state().status).toBe("error");
    await readiness.start(async () => undefined);
    expect(readiness.state().status).toBe("ready");
    await readiness.wait();
  } finally { dispose(); }
});

it("exposes progress, shares startup work and releases pending waiters on disposal", async () => {
  const { readiness, dispose } = createRoot((dispose) => ({
    readiness: createReadiness(),
    dispose,
  }));
  let finish!: () => void;
  let runs = 0;
  const task = async (): Promise<void> => {
    runs++;
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
  };
  const first = readiness.start(task);
  const second = readiness.start(task);
  expect(readiness.state().status).toBe("loading");
  await Promise.resolve();
  expect(runs).toBe(1);
  finish();
  await Promise.all([first, second, readiness.wait()]);
  expect(readiness.state()).toEqual({ status: "ready" });
  dispose();
  await expect(readiness.wait()).rejects.toThrow("disposed");

  const pending = createRoot((dispose) => ({
    readiness: createReadiness(),
    dispose,
  }));
  const waiting = expect(pending.readiness.wait()).rejects.toThrow("disposed");
  pending.dispose();
  await waiting;
});

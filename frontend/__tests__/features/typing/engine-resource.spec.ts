import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
const mocks = vi.hoisted(() => {
  const session = { dispose: vi.fn() };
  const content = {
    dispose: vi.fn(),
    recycleSession: vi.fn(),
    createSession: vi.fn(() => session),
  };
  const engine = { createContent: vi.fn(() => content) };
  return {
    session,
    content,
    engine,
    load: vi.fn(async () => engine),
    disposeLoader: vi.fn(),
    createLoader: vi.fn(),
  };
});
vi.mock("@oxytype/typing-engine/browser.client", () => ({
  createEngineLoader: () => {
    mocks.createLoader();
    return { load: mocks.load, dispose: mocks.disposeLoader };
  },
}));
import { mountApplication } from "../../../src/app/application";
import { getBrowserEngine } from "../../../src/features/typing/engine.client";
import {
  createTestApplication,
  releaseTestApplication,
} from "../../__harness__/mock-application";
releaseTestApplication();
let dispose: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockReset().mockResolvedValue(mocks.engine);
  const app = createTestApplication();
  const release = mountApplication(app.application);
  dispose = () => {
    release();
    app.dispose();
  };
});
afterEach(() => dispose());

it("shares loading, retries failures and forbids sessions until ready", async () => {
  const resource = getBrowserEngine();
  expect(resource.status().state).toBe("idle");
  expect(() => resource.content()).toThrow("not ready");
  mocks.load.mockRejectedValueOnce(new Error("interrupted download"));
  const first = resource.load();
  expect(resource.load()).toBe(first);
  await expect(first).rejects.toThrow("interrupted download");
  expect(resource.status().state).toBe("failed");
  await resource.load();
  expect(resource.status().state).toBe("ready");
  expect(mocks.createLoader).toHaveBeenCalledOnce();
  expect(mocks.load).toHaveBeenCalledTimes(2);
});

it("recycles a replaced session, invalidates host work and releases all app resources", async () => {
  const resource = getBrowserEngine();
  await resource.load();
  const content = resource.beginReplacement();
  const generation = resource.generation();
  const lease = resource.captureSession();
  expect(lease.signal.aborted).toBe(false);
  const session = resource.createPreparedSession();
  expect(resource.session()).toBe(session);
  expect(() => resource.createPreparedSession()).toThrow("prior session");
  expect(resource.beginReplacement()).toBe(content);
  expect(resource.generation()).toBeGreaterThan(generation);
  expect(lease.signal.aborted).toBe(true);
  expect(lease.isCurrent()).toBe(false);
  expect(resource.captureSession().signal.aborted).toBe(false);
  expect(mocks.content.recycleSession).toHaveBeenCalledExactlyOnceWith(session);
  resource.createPreparedSession(true);
  const active = resource.session();
  const pending = resource.captureSession();
  resource.invalidateSession();
  expect(pending.signal.aborted).toBe(true);
  expect(resource.session()).toBe(active);
  dispose();
  expect(mocks.session.dispose).toHaveBeenCalledOnce();
  expect(mocks.content.dispose).toHaveBeenCalledOnce();
  expect(mocks.disposeLoader).toHaveBeenCalledOnce();
  resource.dispose();
  expect(mocks.content.dispose).toHaveBeenCalledOnce();
  expect(resource.status().state).toBe("disposed");
  expect(() => resource.content()).toThrow("disposed");
  await expect(resource.load()).rejects.toThrow("disposed");
});

it("cannot publish initialization after the app owner was disposed", async () => {
  const completion = Promise.withResolvers<typeof mocks.engine>();
  mocks.load.mockReturnValueOnce(completion.promise);
  const resource = getBrowserEngine();
  const loading = resource.load();
  await vi.waitFor(() => expect(mocks.load).toHaveBeenCalledOnce());
  dispose();
  completion.resolve(mocks.engine);
  await expect(loading).rejects.toThrow("disposed");
  expect(resource.status().state).toBe("disposed");
  expect(mocks.engine.createContent).not.toHaveBeenCalled();
});

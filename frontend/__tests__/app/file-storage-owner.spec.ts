import { beforeEach, expect, it, vi } from "vite-plus/test";

const database = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }));
vi.mock("idb", () => ({ openDB: database.open }));

import { mountApplication } from "../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/test-application";

releaseTestApplication();
beforeEach(() => vi.clearAllMocks());

it("opens the existing database lazily and closes each app's connection on disposal", async () => {
  database.open.mockResolvedValue({
    get: async () => "saved-font",
    close: database.close,
  });
  const { default: storage } = await import("../../src/ts/utils/file-storage");
  expect(database.open).not.toHaveBeenCalled();
  for (let i = 0; i < 2; i++) {
    const app = createTestApplication();
    const release = mountApplication(app.application);
    expect(await storage.getFile("LocalFontFamilyFile")).toBe("saved-font");
    expect(database.open).toHaveBeenLastCalledWith(
      "file-storage-db",
      1,
      expect.objectContaining({ upgrade: expect.any(Function) }),
    );
    app.dispose();
    release();
    await Promise.resolve();
    expect(database.close).toHaveBeenCalledTimes(i + 1);
  }
});

it("checks file presence without loading large data URLs", async () => {
  const getKey = vi
    .fn()
    .mockResolvedValueOnce("LocalFontFamilyFile")
    .mockResolvedValueOnce(undefined);
  const get = vi.fn();
  database.open.mockResolvedValue({ getKey, get, close: database.close });
  const { default: storage } = await import("../../src/ts/utils/file-storage");
  const app = createTestApplication();
  const release = mountApplication(app.application);
  try {
    expect(await storage.hasFile("LocalFontFamilyFile")).toBe(true);
    expect(await storage.hasFile("LocalBackgroundFile")).toBe(false);
    expect(getKey).toHaveBeenCalledWith("files", "LocalBackgroundFile");
    expect(get).not.toHaveBeenCalled();
  } finally {
    app.dispose();
    release();
  }
});

it.each(["blocking", "terminated"] as const)(
  "reopens after the connection is %s",
  async (event) => {
    const firstClose = vi.fn();
    database.open
      .mockResolvedValueOnce({ get: async () => "first", close: firstClose })
      .mockResolvedValueOnce({
        get: async () => "second",
        close: database.close,
      });
    const { default: storage } =
      await import("../../src/ts/utils/file-storage");
    const app = createTestApplication();
    const release = mountApplication(app.application);
    try {
      expect(await storage.getFile("LocalFontFamilyFile")).toBe("first");
      const options = database.open.mock.calls[0]?.[2] as Record<
        string,
        () => void
      >;
      options[event]?.();
      expect(await storage.getFile("LocalFontFamilyFile")).toBe("second");
      expect(database.open).toHaveBeenCalledTimes(2);
      expect(firstClose).toHaveBeenCalledTimes(event === "blocking" ? 1 : 0);
    } finally {
      app.dispose();
      release();
    }
  },
);

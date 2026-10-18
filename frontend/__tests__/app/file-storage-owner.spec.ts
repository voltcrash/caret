import { expect, it, vi } from "vite-plus/test";

const database = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }));
vi.mock("idb", () => ({ openDB: database.open }));

import { mountApplication } from "../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/mock-application";

releaseTestApplication();

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

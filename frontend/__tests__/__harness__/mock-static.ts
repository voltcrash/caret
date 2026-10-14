import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { vi } from "vite-plus/test";

const BASE_DIR = resolve(fileURLToPath(import.meta.url), "../../../static");

async function readJson<T>(filePath: string): Promise<T> {
  const fullPath = resolve(BASE_DIR, filePath.replace(/^\//, ""));
  const data = readFileSync(fullPath, "utf-8");
  return JSON.parse(data) as T;
}

vi.mock("../../src/ts/utils/json-data", async (importOriginal) => {
  const original = (await importOriginal()) as any;

  // oxlint-disable-next-line typescript/no-unsafe-return -- Asset fixtures use the loader's runtime module shape.
  return {
    ...original,
    getLayout: async (name: string) => readJson(`/layouts/${name}.json`),
  };
});

/// <reference types="vite/client" />
import { vi } from "vite-plus/test";

const layouts = import.meta.glob("../../static/layouts/*.json", {
  import: "default",
});

vi.mock("../../src/ts/utils/json-data", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/ts/utils/json-data")>();
  return {
    ...original,
    getLayout: async (name: string): ReturnType<typeof original.getLayout> => {
      const load = layouts[`../../static/layouts/${name}.json`];
      if (load === undefined) throw new Error(`Missing test layout: ${name}`);
      return structuredClone(await load()) as Awaited<
        ReturnType<typeof original.getLayout>
      >;
    },
  };
});

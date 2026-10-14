import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const root = resolve(import.meta.dirname, "../../..");
const { scripts } = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
) as { scripts: Record<string, string> };

function assertCommandsExist(files: string[], available = scripts): void {
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /\bvp run (?:--no-cache )?([a-z][a-z0-9:-]*)/g,
    )) {
      expect(available, `${file}: ${match[0]}`).toHaveProperty(match[1] ?? "");
    }
  }
}

describe("root scripts", () => {
  it("keeps every root command invoked by CI", () => {
    const workflows = resolve(root, ".github/workflows");
    assertCommandsExist(
      readdirSync(workflows)
        .filter((file) => file.endsWith(".yml"))
        .map((file) => resolve(workflows, file)),
    );
  });
});

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
  it("preserves aggregate command forwarding and flags", () => {
    expect(
      Object.fromEntries(
        [
          "full-check",
          "ts-check",
          "lint",
          "lint-fix",
          "lint-fast",
          "build",
          "test",
          "dev",
          "start",
        ].map((name) => [name, scripts[name]]),
      ),
    ).toMatchSnapshot();
  });

  it("keeps every root command invoked by CI", () => {
    const workflows = resolve(root, ".github/workflows");
    assertCommandsExist(
      readdirSync(workflows)
        .filter((file) => file.endsWith(".yml"))
        .map((file) => resolve(workflows, file)),
    );
  });

  it("keeps commands documented for contributors and hooks", () => {
    const docs = resolve(root, "docs");
    const hooks = resolve(root, ".husky");
    // Some examples first change into a package (e.g. TUI's assets command).
    const available = { ...scripts };
    for (const directory of ["backend", "frontend", "tui"]) {
      const pkg = JSON.parse(
        readFileSync(resolve(root, directory, "package.json"), "utf8"),
      ) as { scripts: Record<string, string> };
      Object.assign(available, pkg.scripts);
    }
    assertCommandsExist(
      [
        resolve(root, "README.md"),
        resolve(root, "tui/README.md"),
        resolve(root, "AGENTS.md"),
        ...readdirSync(docs)
          .filter((file) => file.endsWith(".md"))
          .map((file) => resolve(docs, file)),
        ...readdirSync(hooks)
          .filter((file) => !file.startsWith(".") && file !== "_")
          .map((file) => resolve(hooks, file)),
      ],
      available,
    );
  });
});

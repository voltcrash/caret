import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { z } from "zod";
import { createWorkerd } from "../__tests__/start/workerd";

const Budget = z.object({
  raw: z.number().int().positive(),
  gzip: z.number().int().positive(),
});

/** Eager JS: Start SSR document entry scripts and modulepreloads. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const path = args.find((arg) => arg !== "--check");
  const worker = await createWorkerd();
  try {
    const response = await worker.dispatchFetch("http://localhost:3000/");
    if (response.status !== 200) {
      throw new Error(`Typing document: ${response.status}`);
    }
    const html = await response.text();
    const files = [
      ...new Set(
        [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.js)"/g)].map(
          (match) => match[1] as string,
        ),
      ),
    ];
    if (files.length === 0) throw new Error("No Start entry/preload JS found");
    const runs = Array.from({ length: 5 }, () => {
      const entries = files.map((file) => {
        const bytes = readFileSync(
          resolve(import.meta.dirname, "../dist/start/client", `.${file}`),
        );
        return { file, raw: bytes.length, gzip: gzipSync(bytes).length };
      });
      return {
        files: entries.length,
        raw: entries.reduce((n, entry) => n + entry.raw, 0),
        gzip: entries.reduce((n, entry) => n + entry.gzip, 0),
        entries,
      };
    });
    const output = `${JSON.stringify(
      {
        definition:
          "Start document entry scripts and explicit modulepreloads; lazy chunks excluded, matching Stage 0",
        runs,
      },
      null,
      2,
    )}\n`;
    if (path !== undefined) writeFileSync(path, output);
    else if (!check) console.log(output);
    if (check) {
      const budget = Budget.parse(
        JSON.parse(
          readFileSync(
            resolve(import.meta.dirname, "eager-js-budget.json"),
            "utf8",
          ),
        ),
      );
      const { raw, gzip } = runs[0] as (typeof runs)[number];
      const failures = (["raw", "gzip"] as const).filter(
        (key) => ({ raw, gzip })[key] > budget[key],
      );
      console.info(
        `Eager JS: ${raw} raw / ${gzip} gzip bytes (budget ${budget.raw} / ${budget.gzip})`,
      );
      if (failures.length > 0) {
        throw new Error(
          `Eager JS exceeds its ${failures.join(" and ")} budget; defer code or raise frontend/scripts/eager-js-budget.json`,
        );
      }
    }
  } finally {
    await worker.dispose();
  }
}
void main();

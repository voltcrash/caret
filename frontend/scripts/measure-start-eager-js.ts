import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { createWorkerd } from "../__tests__/start/workerd";

/** Same entry/preload definition as measure-eager-js, using Start's SSR document. */
async function main(): Promise<void> {
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
    const path = process.argv[2];
    if (path === undefined) console.log(output);
    else writeFileSync(path, output);
  } finally {
    await worker.dispose();
  }
}
void main();

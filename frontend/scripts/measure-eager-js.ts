import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const dist = path.resolve(import.meta.dirname, "../dist");
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
// Count entry scripts and modulepreloads once; gzip each response independently.
const files = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="(\/js\/[^" ]+\.js)"/g)].map(
      (match) => match[1] as string,
    ),
  ),
];
if (files.length === 0) {
  throw new Error(
    "No eager JS found; update asset discovery for the current build before comparing migration budgets",
  );
}
const entries = files.map((file) => {
  const bytes = fs.readFileSync(path.join(dist, file));
  return { file, raw: bytes.length, gzip: gzipSync(bytes).length };
});
console.log(
  JSON.stringify(
    {
      files: entries.length,
      raw: entries.reduce((total, entry) => total + entry.raw, 0),
      gzip: entries.reduce((total, entry) => total + entry.gzip, 0),
      entries,
    },
    null,
    2,
  ),
);

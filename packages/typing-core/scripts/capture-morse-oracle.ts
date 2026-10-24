import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getMorse } from "../src/generate";
const mappings: [number, string][] = [];
let hash = 14695981039346656037n;
let units = 0;
function record(value: string): void {
  const output = getMorse(value);
  const values = [output.length, ...Array.from(output, (c) => c.charCodeAt(0))];
  units += values.length;
  for (const unit of values) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(unit)) * 1099511628211n);
  }
}
for (let unit = 0; unit <= 0xffff; unit++) record(String.fromCharCode(unit));
for (let code = 0; code <= 0x10ffff; code++) {
  if (code >= 0xd800 && code <= 0xdfff) continue;
  const value = String.fromCodePoint(code);
  const output = getMorse(value);
  if (code > 127 && output !== "") mappings.push([code, output]);
  record(value);
}
const root = resolve(import.meta.dirname, "../../..");
writeFileSync(
  resolve(root, "crates/typing-engine/data/morse.rs"),
  `// Mechanically captured from the frozen TypeScript getMorse, Unicode ${process.versions["unicode"]}.\n&[\n${mappings.map(([code, value]) => `    (${code}, ${JSON.stringify(value)}),`).join("\n")}\n]\n`,
  { flag: "wx" },
);
writeFileSync(
  resolve(root, "packages/typing-fixtures/oracle/morse-unicode.json"),
  `${JSON.stringify({ source: `TypeScript getMorse; Node ${process.version}`, unicode: process.versions["unicode"], units, hash: hash.toString(16), mappingCount: mappings.length }, null, 2)}\n`,
  { flag: "wx" },
);

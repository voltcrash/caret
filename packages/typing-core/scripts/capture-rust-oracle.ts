import { readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readCommandFixture, runOracle } from "./rust-oracle";

const root = resolve(import.meta.dirname, "../../typing-fixtures");
// Capture only NEW traces. Deliberately no overwrite/update flag.
const requested = process.argv.slice(2);
for (const name of (requested.length > 0
  ? requested
  : readdirSync(resolve(root, "commands"))
).filter((entry) => entry.endsWith(".json"))) {
  const fixture = readCommandFixture(resolve(root, "commands", name));
  const output = await runOracle(fixture);
  writeFileSync(
    resolve(root, "oracle", name),
    `${JSON.stringify(output, null, 2)}\n`,
    { flag: "wx" },
  );
}

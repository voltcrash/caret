import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
export function rpcPath(name: string): string {
  const dir = resolve(import.meta.dirname, "../../dist/start/server/assets");
  const file = readdirSync(dir).find((file) =>
    file.includes("server-fn-resolver"),
  );
  if (file === undefined) throw new Error("Missing function manifest");
  const source = readFileSync(resolve(dir, file), "utf8");
  const id = [
    ...source.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName:\s*"([^"]+)"/g),
  ].find((match) => match[2] === `${name}_createServerFn_handler`)?.[1];
  if (id === undefined) throw new Error(`Missing function ${name}`);
  return `/_serverFn/${id}`;
}

import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

export async function databaseUrl(environment = process.argv[2]): Promise<string> {
  if (environment !== undefined && !["production", "staging"].includes(environment)) throw new Error("Expected production or staging");
  let url = process.env["DATABASE_URL"];
  if (url === undefined || url === "") {
    const file = environment !== undefined ? `.dev.vars.${environment}` : ".dev.vars";
    url = parseEnv(await readFile(new URL(`../../frontend/${file}`, import.meta.url), "utf8"))["DATABASE_URL"];
  }
  if (url === undefined || url === "") throw new Error("DATABASE_URL is required");
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname.endsWith(".neon.tech") || !parsed.username || !parsed.password || parsed.searchParams.get("sslmode") !== "require") throw new Error("DATABASE_URL must use Neon PostgreSQL with sslmode=require");
  return url;
}

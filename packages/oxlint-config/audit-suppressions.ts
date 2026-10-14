import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("vp", ["exec", "git", "ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter((file) => /\.(?:ts|tsx|js)$/.test(file));

const directives: Record<string, number> = {};
const rules: Record<string, number> = {};
const casts = { source: 0, tests: 0 };
const missingReasons: string[] = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(
    /(?:\/\/|\/\*)\s*(oxlint-disable(?:-next-line|-line)?)\s+([^\n]+)/g,
  )) {
    const [, directive = "", description = ""] = match;
    directives[directive] = (directives[directive] ?? 0) + 1;
    const [names = "", reason = ""] = description.split("--");
    if (reason.replace("*/", "").trim() === "") {
      missingReasons.push(
        `${file}:${source.slice(0, match.index).split("\n").length}`,
      );
    }
    for (const rule of names
      .replace("*/", "")
      .trim()
      .split(/[,\s]+/)) {
      rules[rule] = (rules[rule] ?? 0) + 1;
    }
  }
  for (const match of source.matchAll(/\bas\s+any\b/g)) {
    const line = source.slice(
      source.lastIndexOf("\n", match.index) + 1,
      match.index,
    );
    if (line.trimStart().startsWith("//")) continue;
    const scope = /\/(?:__tests__|__test__)\//.test(file) ? "tests" : "source";
    casts[scope]++;
  }
}
console.log(
  JSON.stringify({ directives, rules, casts, missingReasons }, null, 2),
);
if (missingReasons.length > 0) process.exitCode = 1;

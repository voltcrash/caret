import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { canQuickRestart } from "../src/quick-restart";
import { shouldRepeatQuote } from "../src/restart";
import { defaultCustomTextSettings } from "../src/custom-text";

const quick = [];
const quotes = [];
for (const mode of ["time", "words", "quote", "custom", "zen"] as const) {
  for (const value of [0, 1, 899, 900, 999, 1000]) {
    for (const limitMode of ["word", "section", "time"] as const) {
      for (const customIsLong of [false, true]) {
        const custom = {
          ...defaultCustomTextSettings,
          limit: { mode: limitMode, value },
        };
        quick.push({
          mode,
          words: value,
          time: value,
          limit: custom.limit,
          customIsLong,
          expected: canQuickRestart(mode, value, value, custom, customIsLong),
        });
      }
    }
  }
  for (const repeatQuotes of ["off", "typing"] as const) {
    quotes.push({
      mode,
      repeatQuotes,
      expected: shouldRepeatQuote({ mode, repeatQuotes }),
    });
  }
}
writeFileSync(
  resolve(import.meta.dirname, "../../typing-fixtures/oracle/restart.json"),
  `${JSON.stringify({ quick, quotes }, null, 2)}\n`,
  { flag: "wx" },
);

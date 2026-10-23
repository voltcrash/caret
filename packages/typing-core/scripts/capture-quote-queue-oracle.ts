import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
const original = Math.random;
let state = 91;
Math.random = () => {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
try {
  const { QuotesController } = await import("../src/quote-source");
  const asset = {
    language: "english",
    groups: [
      [0, 10],
      [11, 100],
    ],
    quotes: [
      { id: 1, text: "short", length: 5, source: "fixture" },
      { id: 2, text: "long first words", length: 16, source: "fixture" },
      { id: 3, text: "long second words", length: 17, source: "fixture" },
    ],
  };
  const controller = new QuotesController({
    fetchJson: async () => asset,
    getSnapshot: () => null,
  });
  await controller.getQuotes("english", [0]);
  const initialId = controller.getRandomQuote()?.id;
  const cycles = [];
  for (const lengths of [[1], [0, 1], [0], [1]]) {
    state = 91;
    controller.updateQuoteQueue(lengths);
    const afterUpdateState = state >>> 0;
    const selected = [];
    for (let index = 0; index < 4; index++) {
      state = 91;
      await controller.getQuotes("english", lengths);
      selected.push({
        id: controller.getRandomQuote()?.id,
        afterSelectState: state >>> 0,
      });
    }
    cycles.push({ lengths, afterUpdateState, selected });
  }
  writeFileSync(
    resolve(
      import.meta.dirname,
      "../../typing-fixtures/oracle/quote-queue.json",
    ),
    `${JSON.stringify({ asset, initialId, cycles }, null, 2)}\n`,
    { flag: "wx" },
  );
} finally {
  Math.random = original;
}

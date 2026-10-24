import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PaceTracker } from "../src/pace-caret";

const words = ["one", "two", "😀"];
type Command =
  | { op: "reset"; wpm: number | null }
  | { op: "start" | "advance"; now: number }
  | { op: "step" }
  | { op: "remember"; wpm: number; repeating: boolean };
const commands: Command[] = [
  { op: "reset", wpm: 120 },
  { op: "start", now: 100 },
  ...Array.from({ length: 5 }, () => ({ op: "step" as const })),
  { op: "advance", now: 1200 },
  { op: "advance", now: 5000 },
  { op: "remember", wpm: 77, repeating: false },
  { op: "remember", wpm: 40, repeating: true },
  { op: "remember", wpm: 90, repeating: true },
  { op: "reset", wpm: null },
  { op: "reset", wpm: 0 },
  { op: "reset", wpm: 33 },
  { op: "start", now: 6000 },
  ...Array.from({ length: 10 }, () => ({ op: "step" as const })),
];
const pace = new PaceTracker();
const frames = commands.map((command) => {
  if (command.op === "reset") pace.reset(command.wpm);
  if (command.op === "start") pace.start(command.now);
  if (command.op === "step") pace.step((index) => words[index], false);
  if (command.op === "advance") {
    pace.advanceTo(command.now, (index) => words[index], false);
  }
  if (command.op === "remember") {
    pace.rememberWpm(command.wpm, command.repeating);
  }
  return {
    command,
    expected: {
      position: pace.getPosition(),
      stepEnd: pace.getStepEnd(),
      lastWpm: pace.getLastWpm(),
    },
  };
});
const units = (text: string): number[] =>
  Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
writeFileSync(
  resolve(import.meta.dirname, "../../typing-fixtures/oracle/pace.json"),
  `${JSON.stringify({ targets: words.map((word) => units(`${word} `)), frames }, null, 2)}\n`,
  { flag: "wx" },
);

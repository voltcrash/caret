import { readFileSync } from "node:fs";
import { getDefaultConfig } from "../src/config/default-config";
import { createTestSession, type SessionConfig } from "../src/session";
import type {
  EventLog,
  TestEventData,
  TestEventType,
} from "../src/events/types";
import type { DeleteInputType } from "../src/input/input-type";

export type Text = number[];
export type OracleCommand = {
  op:
    | "insert"
    | "delete"
    | "start"
    | "advance"
    | "finish"
    | "end"
    | "abandon"
    | "reset"
    | "observe"
    | "finalize";
  now: number;
  date?: number;
  data?: Text;
  kind?: DeleteInputType;
  reason?: string;
  correctShiftUsed?: boolean | null;
  automatic?: true;
  isCompositionEnding?: true;
  eventType?: TestEventType;
  eventData?: TestEventData;
};
export type CommandFixture = {
  name: string;
  config: Partial<SessionConfig>;
  words: Text[];
  commands: OracleCommand[];
};

export function units(value: string): Text {
  return Array.from({ length: value.length }, (_, index) =>
    value.charCodeAt(index),
  );
}
export function fromUnits(value: Text): string {
  // Fixtures are bounded; production conversion must use bounded chunks too.
  let result = "";
  for (let i = 0; i < value.length; i += 4096) {
    result += String.fromCharCode(...value.slice(i, i + 4096));
  }
  return result;
}
export function neutralLog(log: EventLog): unknown {
  return {
    ...log,
    context: {
      ...log.context,
      targetWords: log.context.targetWords.map(units),
    },
    events: log.events.map((event) => ({
      ...event,
      data: {
        ...event.data,
        ...("inputValue" in event.data
          ? { inputValue: units(event.data.inputValue) }
          : {}),
        ...("data" in event.data ? { data: units(event.data.data) } : {}),
      },
    })),
  };
}

export async function runOracle(fixture: CommandFixture): Promise<unknown> {
  let date = 0;
  const session = createTestSession(
    { ...getDefaultConfig(), ...fixture.config },
    {
      words: fixture.words.map(fromUnits),
      dateNow: () => date,
    },
  );
  const frames: unknown[] = [];
  for (const command of fixture.commands) {
    date = command.date ?? 0;
    switch (command.op) {
      case "insert":
        await session.insert(fromUnits(command.data ?? []), command.now, {
          correctShiftUsed: command.correctShiftUsed,
          automatic: command.automatic,
          isCompositionEnding: command.isCompositionEnding,
        });
        break;
      case "delete":
        session.delete(command.kind ?? "deleteContentBackward", command.now);
        break;
      case "start":
        session.start(command.now);
        break;
      case "advance":
        session.advance(command.now);
        break;
      case "finish":
        session.finish(command.now, command.reason);
        break;
      case "end":
        session.end(command.now);
        break;
      case "abandon":
        session.abandon(command.now);
        break;
      case "reset":
        session.reset();
        break;
      case "finalize":
        session.recorder.forceReleaseAllKeys();
        session.recorder.cleanupData();
        break;
      case "observe":
        if (
          command.eventType === undefined ||
          command.eventData === undefined
        ) {
          throw new Error("Missing observation");
        }
        session.record(command.eventType, command.now, command.eventData);
        break;
    }
    const log = session.buildEventLog();
    frames.push({
      state: {
        wordIndex: session.getActiveWordIndex(),
        inputValue: units(session.recorder.getCurrentInput()),
        active: session.isActive(),
        ended: log.events.some(
          (event) => event.type === "timer" && event.data.event === "end",
        ),
        ...(session.getFinishReason() === undefined
          ? {}
          : { reason: session.getFinishReason() }),
      },
      log: neutralLog(log),
    });
  }
  // JSON is the legacy transport: omit undefined and map nonfinite values to null.
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- This captures JSON transport semantics, not a deep clone.
  return JSON.parse(JSON.stringify({ name: fixture.name, frames })) as unknown;
}

export function readCommandFixture(path: string): CommandFixture {
  return JSON.parse(readFileSync(path, "utf8")) as CommandFixture;
}

import { expect, it } from "vite-plus/test";
import { nativeSession } from "../../__harness__/native-engine.node";
import {
  analyzeLog,
  encodeText,
  type BrowserSession,
  type Log,
} from "@oxytype/typing-engine/browser.client";
import { projectEngineConfig } from "@oxytype/typing-engine/config";
import {
  CompletedEventSchema,
  type CompletedEvent,
} from "@oxytype/schemas/results";
import { getDefaultConfig } from "../../../src/ts/constants/default-config";
import {
  getResultFailure,
  getKeyDataFailure,
} from "../../../../backend/src/anticheat";

function completedResult(
  session: BrowserSession,
  config: Parameters<typeof projectEngineConfig>[0],
): { log: Log; result: CompletedEvent } {
  const log = session.log();
  const completed = analyzeLog(log, {
    op: "completed",
    context: {
      config: projectEngineConfig(config),
      client: null,
      offline: null,
      currentQuote: null,
      customText: null,
      tags: [],
      bailedOut: false,
      restartCount: 0,
      incompleteTests: [],
      incompleteSeconds: 0,
      timestamp: 1700000000000,
    },
  }).result;
  return {
    log,
    result: CompletedEventSchema.parse({
      ...completed,
      uid: "test-user",
      hash: "hash",
    }),
  };
}

it.each(["physical", "input-only", "single-prestart"])(
  "accepts completed native sessions with %s keyboard telemetry",
  (keyboard) => {
    const config = {
      ...getDefaultConfig(),
      mode: "time" as const,
      time: 15,
      stopOnError: "word" as const,
    };
    const session = nativeSession(
      config,
      Array.from({ length: 80 }, () => "abc "),
    );
    try {
      if (keyboard === "single-prestart") {
        session.command({
          op: "observe",
          eventType: "keydown",
          eventData: { code: "KeyA" },
          now: 800,
        });
        session.command({
          op: "observe",
          eventType: "keyup",
          eventData: { code: "KeyA" },
          now: 850,
        });
      }
      for (let i = 0; i < 154; i++) {
        const now = 1000 + i * 97;
        const data = "abc ".charAt(i % 4);
        const code = data === " " ? "Space" : `Key${data.toUpperCase()}`;
        if (keyboard === "physical") {
          session.command({
            op: "observe",
            eventType: "keydown",
            eventData: { code },
            now,
          });
        }
        session.command({
          op: "insert",
          data: encodeText(data),
          now: now + 1,
          date: now + 1,
          automatic: null,
          isCompositionEnding: null,
          correctShiftUsed: null,
        });
        if (keyboard === "physical") {
          session.command({
            op: "observe",
            eventType: "keyup",
            eventData: { code },
            now: now + 40,
          });
        }
      }
      session.command({ op: "advance", now: 16001, date: 16001 });
      session.command({ op: "finalize", now: 16002 });
      session.command({ op: "finalize", now: 16003 });
      const { result } = completedResult(session, config);
      expect(result).toMatchObject({
        wpm: 123.2,
        rawWpm: 123.2,
        charStats: [154, 0, 0, 0],
        testDuration: 15,
      });
      expect(getResultFailure(result)).toBeUndefined();
      expect(getKeyDataFailure(result)).toBeUndefined();
    } finally {
      session.dispose();
    }
  },
);

it.each([1000])(
  "keeps results valid when typing continues during result loading, clock origin %i",
  async (origin) => {
    const config = {
      ...getDefaultConfig(),
      mode: "time" as const,
      time: 15,
      stopOnError: "word" as const,
    };
    const session = nativeSession(
      config,
      Array.from({ length: 80 }, () => "abc "),
    );
    try {
      for (let i = 0; i < 144; i++) {
        const now = origin + i * 104;
        const data = "abc ".charAt(i % 4);
        const code = data === " " ? "Space" : `Key${data.toUpperCase()}`;
        session.command({
          op: "observe",
          eventType: "keydown",
          eventData: { code },
          now,
        });
        session.command({
          op: "insert",
          data: encodeText(data),
          now: now + 1,
          date: now + 1,
          automatic: null,
          isCompositionEnding: null,
          correctShiftUsed: null,
        });
        session.command({
          op: "observe",
          eventType: "keyup",
          eventData: { code },
          now: now + 40,
        });
      }
      session.command({
        op: "advance",
        now: origin + 15011,
        date: origin + 15011,
      });
      session.command({ op: "finalize", now: origin + 15012 });
      session.command({ op: "finalize", now: origin + 15013 });
      const finished = session.log();
      // A slow result import yields to further keyboard events after cleanup.
      session.command({
        op: "observe",
        eventType: "keydown",
        eventData: { code: "KeyA" },
        now: origin + 1 + 15182.7,
      });
      session.command({
        op: "observe",
        eventType: "keyup",
        eventData: { code: "KeyA" },
        now: origin + 1 + 15220,
      });
      const { log, result } = completedResult(session, config);
      expect(result).toMatchObject({
        wpm: 115.12,
        testDuration: 15.01,
        charStats: [144, 0, 0, 0],
      });
      expect(getResultFailure(result)).toBeUndefined();
      expect(getKeyDataFailure(result)).toBeUndefined();
      expect(log).toEqual(finished);
    } finally {
      session.dispose();
    }
  },
);

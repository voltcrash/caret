import { expect, it } from "vite-plus/test";
import { nativeSession } from "../../__harness__/native-engine.node";
import { analyzeLog, encodeText } from "@oxytype/typing-engine/browser.client";
import { projectEngineConfig } from "@oxytype/typing-engine/config";
import { CompletedEventSchema } from "@oxytype/schemas/results";
import { getDefaultConfig } from "../../../src/ts/constants/default-config";
import {
  getResultFailure,
  getKeyDataFailure,
} from "../../../../backend/src/anticheat";

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
      const result = CompletedEventSchema.parse({
        ...completed,
        uid: "test-user",
        hash: "hash",
      });
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

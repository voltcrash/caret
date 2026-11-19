import { describe, it, expect } from "vite-plus/test";
import { completedEvent } from "../__testData__/completed-event";
import * as pb from "../../src/utils/pb";
import { Mode, PersonalBests } from "@caret/schemas/shared";
import { Result } from "@caret/schemas/results";
import { FunboxName } from "@caret/schemas/configs";

describe("Pb Utils", () => {
  describe("funboxCatGetPb", () => {
    const testCases: { funbox: FunboxName[] | undefined; expected: boolean }[] =
      [
        {
          funbox: ["plus_one"],
          expected: true,
        },
        {
          funbox: [],
          expected: true,
        },
        {
          funbox: undefined,
          expected: true,
        },
        {
          funbox: ["nausea", "plus_one"],
          expected: true,
        },
        {
          funbox: ["arrows"],
          expected: false,
        },
      ];

    it.each(testCases)(
      "canFunboxGetPb with $funbox = $expected",
      ({ funbox, expected }) => {
        const result = pb.canFunboxGetPb({ funbox } as any);
        expect(result).toBe(expected);
      },
    );
  });

  describe("checkAndUpdatePb", () => {
    it("should update personal best", () => {
      const userPbs: PersonalBests = {
        time: {},
        words: {},
        custom: {},
        quote: {},
        zen: {},
      };
      const result = {
        difficulty: "normal",
        language: "english",
        punctuation: false,
        lazyMode: false,
        acc: 100,
        consistency: 100,
        rawWpm: 100,
        wpm: 110,
        numbers: false,
        mode: "time",
        mode2: "15",
      } as unknown as Result<Mode>;

      const run = pb.checkAndUpdatePb(
        userPbs,
        {} as pb.LbPersonalBests,
        result,
      );

      expect(run.isPb).toBe(true);
      expect(run.personalBests.time?.["15"]?.[0]).not.toBe(undefined);
      expect(run.lbPersonalBests).not.toBe({});
    });
    it("should not override default pb when saving numbers test", () => {
      const userPbs: PersonalBests = {
        time: {
          "15": [
            {
              acc: 100,
              consistency: 100,
              difficulty: "normal",
              lazyMode: false,
              language: "english",
              numbers: false,
              punctuation: false,
              raw: 100,
              timestamp: 0,
              wpm: 100,
            },
          ],
        },
        words: {},
        custom: {},
        quote: {},
        zen: {},
      };
      const result = {
        difficulty: "normal",
        language: "english",
        punctuation: false,
        lazyMode: false,
        acc: 100,
        consistency: 100,
        rawWpm: 100,
        wpm: 110,
        numbers: true,
        mode: "time",
        mode2: "15",
      } as unknown as Result<Mode>;

      const run = pb.checkAndUpdatePb(userPbs, undefined, result);

      expect(run.isPb).toBe(true);

      expect(run.personalBests.time?.["15"]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ numbers: false, wpm: 100 }),
          expect.objectContaining({ numbers: true, wpm: 110 }),
        ]),
      );
    });
  });
  it("ranks the eligible run independently of faster practice PBs", () => {
    const practice = completedEvent({ mode2: "15", lazyMode: true, wpm: 120 });
    const personalBests: PersonalBests = {
      time: {},
      words: {},
      custom: {},
      quote: {},
      zen: {},
    };
    const board: pb.LbPersonalBests = { time: {} };
    pb.checkAndUpdatePb(personalBests, board, practice);
    expect(board.time).toEqual({});
    const ranked = { ...practice, lazyMode: false, wpm: 80 };
    pb.checkAndUpdatePb(personalBests, board, ranked);
    expect(board.time[15]?.["english"]?.wpm).toBe(80);
    pb.checkAndUpdatePb(personalBests, board, { ...ranked, wpm: 70 });
    expect(board.time[15]?.["english"]?.wpm).toBe(80);
  });
});

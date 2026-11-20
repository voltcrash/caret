import { expect, it } from "vite-plus/test";
import { serializeResultsCsv } from "../../../src/features/account/results-csv.client";

it("keeps combined funboxes in one field before difficulty", () => {
  const csv = serializeResultsCsv([
    {
      _id: "result",
      uid: "user",
      name: "typist",
      mode: "time",
      mode2: "15",
      timestamp: 1000,
      testDuration: 15,
      wpm: 80,
      rawWpm: 80,
      acc: 100,
      consistency: 100,
      keyConsistency: 100,
      charStats: [100, 0, 0, 0],
      chartData: "toolong",
      funbox: ["read_ahead", "tts"],
      difficulty: "normal",
    },
  ]);
  const [header, row] = csv.split("\n");
  expect(header).toContain("language,funbox,difficulty");
  expect(row).toContain(',,"read_ahead,tts",normal,');
});

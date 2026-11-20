import { captureTypingPresentation } from "../../scope";
import { currentResult, resultAnnotations } from "./context";
import { peekConfig } from "#shared/config/store.ts";
import * as DB from "#shared/db.ts";
import * as Numbers from "@caret/util/numbers";
import { get as getTypingSpeedUnit } from "#shared/utils/typing-speed-units.ts";
import { getFunbox } from "@caret/funbox";
import { getTheme } from "#shared/states/theme.ts";

export async function updateChartPBLine(): Promise<void> {
  const lease = captureTypingPresentation();
  const { Chart } = await import("chart.js");
  if (!lease.isCurrent()) return;
  const themecolors = getTheme();
  const localPb = DB.getLocalPB(
    currentResult().mode,
    currentResult().mode2,
    currentResult().punctuation ?? false,
    currentResult().numbers ?? false,
    currentResult().language,
    currentResult().difficulty,
    currentResult().lazyMode ?? false,
    getFunbox(currentResult().funbox),
  );
  const localPbWpm = localPb?.wpm ?? 0;
  if (localPbWpm === 0) return;
  const typingSpeedUnit = getTypingSpeedUnit(peekConfig().typingSpeedUnit);
  const chartlpb = Numbers.roundTo2(
    typingSpeedUnit.fromWpm(localPbWpm),
  ).toFixed(2);
  resultAnnotations().push({
    display: true,
    type: "line",
    id: "lpb",
    scaleID: "wpm",
    value: chartlpb,
    borderColor: `${themecolors.sub}55`,
    borderWidth: 1,
    // borderDash: [4, 16],
    label: {
      backgroundColor: themecolors.sub,
      font: {
        family: peekConfig().fontFamily.replace(/_/g, " "),
        size: 11,
        style: "normal",
        weight: Chart.defaults.font.weight,
        lineHeight: Chart.defaults.font.lineHeight as number,
      },
      color: themecolors.bg,
      padding: 3,
      borderRadius: 3,
      position: "center",
      content: ` PB: ${chartlpb} `,
      display: true,
    },
  });
}

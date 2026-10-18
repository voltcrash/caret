import { captureTypingRoute } from "../../scope";
import { result, resultAnnotation } from "./context";
import { getMutableConfig } from "../../../../ts/config/store";
import * as DB from "../../../../ts/db";
import * as Numbers from "@oxytype/util/numbers";
import { get as getTypingSpeedUnit } from "../../../../ts/utils/typing-speed-units";
import { getFunbox } from "@oxytype/funbox";
import { getTheme } from "../../../../ts/states/theme";

export async function updateChartPBLine(): Promise<void> {
  const lease = captureTypingRoute();
  const { Chart } = await import("chart.js");
  if (!lease.isCurrent()) return;
  const themecolors = getTheme();
  const localPb = DB.getLocalPB(
    result.mode,
    result.mode2,
    result.punctuation ?? false,
    result.numbers ?? false,
    result.language,
    result.difficulty,
    result.lazyMode ?? false,
    getFunbox(result.funbox),
  );
  const localPbWpm = localPb?.wpm ?? 0;
  if (localPbWpm === 0) return;
  const typingSpeedUnit = getTypingSpeedUnit(
    getMutableConfig().typingSpeedUnit,
  );
  const chartlpb = Numbers.roundTo2(
    typingSpeedUnit.fromWpm(localPbWpm),
  ).toFixed(2);
  resultAnnotation.push({
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
        family: getMutableConfig().fontFamily.replace(/_/g, " "),
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

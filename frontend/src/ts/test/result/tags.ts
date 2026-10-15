import { resultCanGetPb } from "./crown";
import { result, resultAnnotation } from "./context";
import { getMutableConfig } from "../../config/store";
import * as Numbers from "@oxytype/util/numbers";
import { get as getTypingSpeedUnit } from "../../utils/typing-speed-units";
import type { LabelPosition } from "chartjs-plugin-annotation";
import {
  getActiveTags,
  getLocalTagPB,
  getTag,
  getTags,
  saveLocalTagPB,
  type TagItem,
} from "../../collections/tags";
import { getTheme } from "../../states/theme";
import {
  resultState,
  setResultState,
  type ResultTag,
} from "../../states/result";

export function updateSavedResultId(resultId: string): void {
  setResultState("tags", "savedResultId", resultId);
}

export async function updateTags(dontSave: boolean): Promise<void> {
  const { Chart } = await import("chart.js");
  const activeTags: TagItem[] = getActiveTags();
  const userTagsCount = getTags().length;
  const items: ResultTag[] = [];

  let annotationSide: LabelPosition = "start";
  let labelAdjust = 15;
  for (const tag of activeTags) {
    const tpb = getLocalTagPB(
      tag._id,
      getMutableConfig().mode,
      result.mode2,
      getMutableConfig().punctuation,
      getMutableConfig().numbers,
      getMutableConfig().language,
      getMutableConfig().difficulty,
      getMutableConfig().lazyMode,
    );
    const item: ResultTag = {
      id: tag._id,
      name: tag.name,
      ariaLabel: `PB: ${tpb}`,
      pb: false,
    };
    items.push(item);
    const typingSpeedUnit = getTypingSpeedUnit(
      getMutableConfig().typingSpeedUnit,
    );
    if (
      getMutableConfig().mode !== "quote" &&
      !dontSave &&
      (await resultCanGetPb()).value
    ) {
      if (tpb < result.wpm) {
        //new pb for that tag
        saveLocalTagPB(
          tag._id,
          getMutableConfig().mode,
          result.mode2,
          getMutableConfig().punctuation,
          getMutableConfig().numbers,
          getMutableConfig().language,
          getMutableConfig().difficulty,
          getMutableConfig().lazyMode,
          result.wpm,
          result.acc,
          result.rawWpm,
          result.consistency,
        );
        item.pb = true;
        item.ariaLabel = `+${Numbers.roundTo2(result.wpm - tpb)}`;
        // console.log("new pb for tag " + tag.display);
      } else {
        const themecolors = getTheme();
        resultAnnotation.push({
          display: true,
          type: "line",
          id: "tpb",
          scaleID: "wpm",
          value: typingSpeedUnit.fromWpm(tpb),
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
            position: annotationSide,
            xAdjust: labelAdjust,
            display: true,
            content: `${tag.name} PB: ${Numbers.roundTo2(
              typingSpeedUnit.fromWpm(tpb),
            ).toFixed(2)}`,
          },
        });
        if (annotationSide === "start") {
          annotationSide = "end";
          labelAdjust = -15;
        } else {
          annotationSide = "start";
          labelAdjust = 15;
        }
      }
    }
  }

  setResultState("tags", {
    visible: userTagsCount > 0,
    items,
  });
}

export function updateTagsAfterEdit(
  tagIds: string[],
  tagPbIds: string[],
): void {
  const kept = resultState.tags.items.filter((tag) => tagIds.includes(tag.id));
  const added: ResultTag[] = tagIds
    .filter((id) => !kept.some((tag) => tag.id === id))
    .map((id) => ({
      id,
      name: getTag(id)?.name ?? "",
      pb: tagPbIds.includes(id),
    }));

  setResultState("tags", "items", [...kept, ...added]);
}

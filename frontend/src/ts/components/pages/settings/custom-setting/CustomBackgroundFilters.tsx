import { createUniqueId, JSXElement } from "solid-js";

import { configMetadata } from "../../../../config/metadata";
import { setConfig } from "../../../../config/setters";
import { getConfig } from "../../../../config/store";
import { applyCustomBackgroundFilters } from "../../../../controllers/theme-controller";
import { Slider } from "../../../common/Slider";
import { SearchableSetting } from "../SearchableSetting";

export function CustomBackgroundFilters(): JSXElement {
  const blurId = createUniqueId();
  const brightnessId = createUniqueId();
  const saturateId = createUniqueId();
  const opacityId = createUniqueId();
  let refBlur: HTMLInputElement | undefined = undefined;
  let refBrightness: HTMLInputElement | undefined = undefined;
  let refSaturate: HTMLInputElement | undefined = undefined;
  let refOpacity: HTMLInputElement | undefined = undefined;

  const refValues = () => {
    if (!refBlur || !refBrightness || !refSaturate || !refOpacity) {
      return undefined;
    }
    return [
      Number(refBlur.value),
      Number(refBrightness.value),
      Number(refSaturate.value),
      Number(refOpacity.value),
    ] as [number, number, number, number];
  };

  return (
    <SearchableSetting
      key="customBackgroundFilter"
      title="custom background filters"
      description={configMetadata.customBackgroundFilter.description}
      fa={configMetadata.customBackgroundFilter.fa}
      fullWidthInputs={
        <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div class="grid grid-cols-[7rem_1fr] items-center gap-2">
            <label for={blurId}>blur</label>
            <Slider
              id={blurId}
              label="Background blur"
              ref={(el) => (refBlur = el)}
              min={0}
              max={5}
              step={0.1}
              text={(value) => {
                return value.toFixed(1);
              }}
              value={getConfig.customBackgroundFilter[0]}
              onEveryChange={() => applyCustomBackgroundFilters(refValues())}
              onChange={(value) => {
                if (value === getConfig.customBackgroundFilter[0]) return;
                setConfig("customBackgroundFilter", [
                  value,
                  getConfig.customBackgroundFilter[1],
                  getConfig.customBackgroundFilter[2],
                  getConfig.customBackgroundFilter[3],
                ]);
              }}
            />
          </div>
          <div class="grid grid-cols-[7rem_1fr] items-center gap-2">
            <label for={brightnessId}>brightness</label>
            <Slider
              id={brightnessId}
              label="Background brightness"
              ref={(el) => (refBrightness = el)}
              min={0}
              max={2}
              step={0.1}
              text={(value) => {
                return value.toFixed(1);
              }}
              value={getConfig.customBackgroundFilter[1]}
              onEveryChange={() => applyCustomBackgroundFilters(refValues())}
              onChange={(value) => {
                if (value === getConfig.customBackgroundFilter[1]) return;
                setConfig("customBackgroundFilter", [
                  getConfig.customBackgroundFilter[0],
                  value,
                  getConfig.customBackgroundFilter[2],
                  getConfig.customBackgroundFilter[3],
                ]);
              }}
            />
          </div>
          <div class="grid grid-cols-[7rem_1fr] items-center gap-2">
            <label for={saturateId}>saturate</label>
            <Slider
              id={saturateId}
              label="Background saturation"
              ref={(el) => (refSaturate = el)}
              min={0}
              max={2}
              step={0.1}
              text={(value) => {
                return value.toFixed(1);
              }}
              value={getConfig.customBackgroundFilter[2]}
              onEveryChange={() => applyCustomBackgroundFilters(refValues())}
              onChange={(value) => {
                if (value === getConfig.customBackgroundFilter[2]) return;
                setConfig("customBackgroundFilter", [
                  getConfig.customBackgroundFilter[0],
                  getConfig.customBackgroundFilter[1],
                  value,
                  getConfig.customBackgroundFilter[3],
                ]);
              }}
            />
          </div>
          <div class="grid grid-cols-[7rem_1fr] items-center gap-2">
            <label for={opacityId}>opacity</label>
            <Slider
              id={opacityId}
              label="Background opacity"
              ref={(el) => (refOpacity = el)}
              min={0}
              max={1}
              step={0.1}
              text={(value) => {
                return value.toFixed(1);
              }}
              value={getConfig.customBackgroundFilter[3]}
              onEveryChange={() => applyCustomBackgroundFilters(refValues())}
              onChange={(value) => {
                if (value === getConfig.customBackgroundFilter[3]) return;
                setConfig("customBackgroundFilter", [
                  getConfig.customBackgroundFilter[0],
                  getConfig.customBackgroundFilter[1],
                  getConfig.customBackgroundFilter[2],
                  value,
                ]);
              }}
            />
          </div>
        </div>
      }
    />
  );
}

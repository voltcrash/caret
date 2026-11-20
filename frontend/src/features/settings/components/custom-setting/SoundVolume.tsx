import { JSXElement } from "solid-js";

import { Slider } from "#shared/components/common/Slider.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import {
  playClick,
  previewClick,
} from "#shared/controllers/sound-controller.ts";

import { SearchableSetting } from "../SearchableSetting";

export function SoundVolume(): JSXElement {
  return (
    <SearchableSetting
      key="soundVolume"
      title="sound volume"
      description={configMetadata.soundVolume.description}
      fa={configMetadata.soundVolume.fa}
      inputs={
        <Slider
          label="Sound volume"
          min={0}
          max={1}
          step={0.1}
          text={(value) => {
            return value.toFixed(1);
          }}
          value={getConfig.soundVolume}
          onChange={(value) => {
            if (value === getConfig.soundVolume) return;
            if (getConfig.playSoundOnClick === "off") {
              void previewClick("1");
            } else {
              void playClick();
            }
            setConfig("soundVolume", value);
          }}
        />
      }
    />
  );
}

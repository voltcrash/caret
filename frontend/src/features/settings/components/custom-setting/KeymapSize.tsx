import { JSXElement } from "solid-js";

import { Slider } from "#shared/components/common/Slider.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";

import { SearchableSetting } from "../SearchableSetting";

export function KeymapSize(): JSXElement {
  return (
    <SearchableSetting
      key="keymapSize"
      title="keymap size"
      description={configMetadata.keymapSize.description}
      fa={configMetadata.keymapSize.fa}
      inputs={
        <Slider
          label="Keymap size"
          min={0.5}
          max={3.5}
          step={0.1}
          text={(value) => {
            return value.toFixed(1);
          }}
          value={getConfig.keymapSize}
          onChange={(value) => {
            if (value === getConfig.keymapSize) return;
            setConfig("keymapSize", value);
          }}
        />
      }
    />
  );
}

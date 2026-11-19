import { JSXElement } from "solid-js";

import { Slider } from "../../../../ts/components/common/Slider";
import { configMetadata } from "../../../../ts/config/metadata";
import { setConfig } from "../../../../ts/config/setters";
import { getConfig } from "../../../../ts/config/store";
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

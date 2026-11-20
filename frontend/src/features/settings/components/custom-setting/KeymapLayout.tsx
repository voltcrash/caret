import { KeymapLayout as KeymapLayoutSchema } from "@caret/schemas/configs";
import { JSXElement } from "solid-js";

import Select from "#shared/components/ui/Select.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import { LayoutsList } from "#shared/constants/layouts.ts";

import { SearchableSetting } from "../SearchableSetting";

export function KeymapLayout(): JSXElement {
  return (
    <SearchableSetting
      key="keymapLayout"
      title="keymap layout"
      description={configMetadata.keymapLayout.description}
      fa={configMetadata.keymapLayout.fa}
      inputs={
        <Select
          label="Keymap layout"
          options={[
            {
              text: "emulator sync",
              value: "overrideSync",
            },
            ...LayoutsList.map((layout) => {
              return {
                text: layout.replace(/_/g, " "),
                value: layout,
              };
            }),
          ]}
          selected={getConfig.keymapLayout}
          onChange={(val) => {
            if (getConfig.keymapLayout === (val as KeymapLayoutSchema)) return;
            setConfig("keymapLayout", val as KeymapLayoutSchema);
          }}
        />
      }
    />
  );
}

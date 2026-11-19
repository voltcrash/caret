import { KeymapLayout as KeymapLayoutSchema } from "@caret/schemas/configs";
import { JSXElement } from "solid-js";

import Select from "../../../../ts/components/ui/Select";
import { configMetadata } from "../../../../ts/config/metadata";
import { setConfig } from "../../../../ts/config/setters";
import { getConfig } from "../../../../ts/config/store";
import { LayoutsList } from "../../../../ts/constants/layouts";
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

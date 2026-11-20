import { Layout as LayoutSchema } from "@caret/schemas/configs";
import { JSXElement } from "solid-js";

import Select from "#shared/components/ui/Select.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import { LayoutsList } from "#shared/constants/layouts.ts";

import { SearchableSetting } from "../SearchableSetting";

export function Layout(): JSXElement {
  return (
    <SearchableSetting
      key="layout"
      title="layout"
      description={configMetadata.layout.description}
      fa={configMetadata.layout.fa}
      inputs={
        <Select
          label="Layout"
          options={LayoutsList.map((layout) => ({
            text: layout.replace(/_/g, " "),
            value: layout,
          }))}
          selected={getConfig.layout}
          onChange={(val) => {
            if (getConfig.layout === (val as LayoutSchema)) return;
            setConfig("layout", val as LayoutSchema);
          }}
        />
      }
    />
  );
}

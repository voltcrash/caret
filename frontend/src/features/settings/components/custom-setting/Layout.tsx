import { Layout as LayoutSchema } from "@caret/schemas/configs";
import { JSXElement } from "solid-js";

import Select from "../../../../ts/components/ui/Select";
import { configMetadata } from "../../../../ts/config/metadata";
import { setConfig } from "../../../../ts/config/setters";
import { getConfig } from "../../../../ts/config/store";
import { LayoutsList } from "../../../../ts/constants/layouts";
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

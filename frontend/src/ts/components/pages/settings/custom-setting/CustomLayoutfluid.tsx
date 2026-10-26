import { CustomLayoutFluid } from "@caret/schemas/configs";
import { JSXElement } from "solid-js";

import { configMetadata } from "../../../../config/metadata";
import { setConfig } from "../../../../config/setters";
import { getConfig } from "../../../../config/store";
import { LayoutsList } from "../../../../constants/layouts";
import { areUnsortedArraysEqual } from "../../../../utils/arrays";
import Select from "../../../ui/Select";
import { SearchableSetting } from "../SearchableSetting";

export function CustomLayoutfluid(): JSXElement {
  return (
    <SearchableSetting
      key="customLayoutfluid"
      title="custom layoutfluid"
      description={configMetadata.customLayoutfluid.description}
      fa={configMetadata.customLayoutfluid.fa}
      inputs={
        <Select
          label="Layoutfluid layouts"
          multiple
          settings={{
            closeOnSelect: false,
            allowDeselect: true,
            minSelected: 2,
          }}
          options={LayoutsList.map((layout) => ({
            text: layout.replace(/_/g, " "),
            value: layout,
          }))}
          selected={getConfig.customLayoutfluid}
          onChange={(val) => {
            if (
              areUnsortedArraysEqual(
                getConfig.customLayoutfluid,
                val as CustomLayoutFluid,
              )
            ) {
              return;
            }
            setConfig("customLayoutfluid", val as CustomLayoutFluid);
          }}
        />
      }
    />
  );
}

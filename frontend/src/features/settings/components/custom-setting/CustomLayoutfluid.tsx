import { CustomLayoutFluid } from "@caret/schemas/configs";
import { JSXElement } from "solid-js";

import Select from "#shared/components/ui/Select.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import { LayoutsList } from "#shared/constants/layouts.ts";
import { areUnsortedArraysEqual } from "#shared/utils/arrays.ts";

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

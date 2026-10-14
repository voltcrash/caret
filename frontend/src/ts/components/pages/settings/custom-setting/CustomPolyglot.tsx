import { CustomPolyglot as CustomPolyglotType } from "@oxytype/schemas/configs";
import { JSXElement } from "solid-js";

import { configMetadata } from "../../../../config/metadata";
import { setConfig } from "../../../../config/setters";
import { getConfig } from "../../../../config/store";
import {
  LanguageGroupNames,
  LanguageGroups,
} from "../../../../constants/languages";
import { areUnsortedArraysEqual } from "../../../../utils/arrays";
import { getLanguageDisplayString } from "../../../../utils/strings";
import Select, { SelectOptionGroup } from "../../../ui/Select";
import { SearchableSetting } from "../SearchableSetting";

export function CustomPolyglot(): JSXElement {
  return (
    <SearchableSetting
      key="customPolyglot"
      title="polyglot languages"
      description={configMetadata.customPolyglot.description}
      fa={configMetadata.customPolyglot.fa}
      inputs={
        <Select
          label="Polyglot languages"
          multiple
          settings={{
            closeOnSelect: false,
            allowDeselect: true,
            minSelected: 2,
          }}
          optionGroups={LanguageGroupNames.map(
            (group) =>
              ({
                label: group,
                options: LanguageGroups[group]?.map((language) => ({
                  text: getLanguageDisplayString(language),
                  value: language,
                })),
              }) as SelectOptionGroup,
          )}
          selected={getConfig.customPolyglot}
          onChange={(val) => {
            if (
              areUnsortedArraysEqual(
                getConfig.customPolyglot,
                val as CustomPolyglotType,
              )
            ) {
              return;
            }
            setConfig("customPolyglot", val as CustomPolyglotType);
          }}
        />
      }
    />
  );
}

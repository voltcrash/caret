import { CustomPolyglot as CustomPolyglotType } from "@caret/schemas/configs";
import { JSXElement } from "solid-js";

import Select, { SelectOptionGroup } from "../../../../ts/components/ui/Select";
import { configMetadata } from "../../../../ts/config/metadata";
import { setConfig } from "../../../../ts/config/setters";
import { getConfig } from "../../../../ts/config/store";
import {
  LanguageGroupNames,
  LanguageGroups,
} from "../../../../ts/constants/languages";
import { areUnsortedArraysEqual } from "../../../../ts/utils/arrays";
import { getLanguageDisplayString } from "../../../../ts/utils/strings";
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

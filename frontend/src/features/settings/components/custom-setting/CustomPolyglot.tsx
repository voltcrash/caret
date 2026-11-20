import { CustomPolyglot as CustomPolyglotType } from "@caret/schemas/configs";
import { JSXElement } from "solid-js";

import Select, { SelectOptionGroup } from "#shared/components/ui/Select.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import {
  LanguageGroupNames,
  LanguageGroups,
} from "#shared/constants/languages.ts";
import { areUnsortedArraysEqual } from "#shared/utils/arrays.ts";
import { getLanguageDisplayString } from "#shared/utils/strings.ts";

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

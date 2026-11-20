import { Language as LanguageSchema } from "@caret/schemas/languages";
import { JSXElement } from "solid-js";

import Select, { SelectOptionGroup } from "#shared/components/ui/Select.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import {
  LanguageGroupNames,
  LanguageGroups,
} from "#shared/constants/languages.ts";
import { getLanguageDisplayString } from "#shared/utils/strings.ts";

import { SearchableSetting } from "../SearchableSetting";

export function Language(): JSXElement {
  return (
    <SearchableSetting
      key="language"
      title="language"
      description={configMetadata.language.description}
      fa={configMetadata.language.fa}
      inputs={
        <Select
          label="Language"
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
          selected={getConfig.language}
          onChange={(val) => {
            if (getConfig.language === (val as LanguageSchema)) return;
            setConfig("language", val as LanguageSchema);
          }}
        />
      }
    />
  );
}

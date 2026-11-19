import { Language as LanguageSchema } from "@caret/schemas/languages";
import { JSXElement } from "solid-js";

import Select, { SelectOptionGroup } from "../../../../ts/components/ui/Select";
import { configMetadata } from "../../../../ts/config/metadata";
import { setConfig } from "../../../../ts/config/setters";
import { getConfig } from "../../../../ts/config/store";
import {
  LanguageGroupNames,
  LanguageGroups,
} from "../../../../ts/constants/languages";
import { getLanguageDisplayString } from "../../../../ts/utils/strings";
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

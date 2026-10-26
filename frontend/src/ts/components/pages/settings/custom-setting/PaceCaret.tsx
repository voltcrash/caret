import {
  ConfigSchema,
  PaceCaretCustomSpeedSchema,
} from "@caret/schemas/configs";
import { createForm } from "@tanstack/solid-form";
import { For, JSXElement } from "solid-js";

import {
  configMetadata,
  getOptionSearchKeywords,
} from "../../../../config/metadata";
import { setConfig } from "../../../../config/setters";
import { getConfig } from "../../../../config/store";
import { useSavedIndicator } from "../../../../hooks/useSavedIndicator";
import { getOptions } from "../../../../utils/zod";
import { Button } from "../../../common/Button";
import { InputField } from "../../../ui/form/InputField";
import { fromSchema } from "../../../ui/form/utils";
import { SearchableSetting } from "../SearchableSetting";
import { SettingsSearchMatch } from "../SettingsSearchMatch";

export function PaceCaret(): JSXElement {
  const savedIndicator = useSavedIndicator();

  const form = createForm(() => ({
    defaultValues: {
      paceCaretCustomSpeed: getConfig.paceCaretCustomSpeed,
    },
    onSubmit: ({ value }) => {
      const val = value.paceCaretCustomSpeed;
      if (val === getConfig.paceCaretCustomSpeed) return;
      if (getConfig.paceCaret !== "off") {
        //
      } else {
        setConfig("paceCaret", "custom");
      }
      savedIndicator.flash();
      setConfig("paceCaretCustomSpeed", val);
    },
  }));

  return (
    <SearchableSetting
      key="paceCaret"
      resetKeys={["paceCaretCustomSpeed", "paceCaret"]}
      onReset={() =>
        form.reset({ paceCaretCustomSpeed: getConfig.paceCaretCustomSpeed })
      }
      title={configMetadata.paceCaret.displayString ?? "pace caret"}
      fa={configMetadata.paceCaret.fa}
      extraSearchKeywords={getOptionSearchKeywords("paceCaret")}
      description={configMetadata.paceCaret.description}
      inputs={
        <div class="grid w-full gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field
              name="paceCaretCustomSpeed"
              validators={{
                onChange: fromSchema(PaceCaretCustomSpeedSchema),
              }}
              listeners={{
                onBlur: () => {
                  void form.handleSubmit();
                },
              }}
              children={(field) => (
                <div class="relative">
                  <InputField
                    field={field}
                    schema={PaceCaretCustomSpeedSchema}
                    placeholder={"pace caret speed"}
                    type="number"
                    resetToDefaultIfEmptyOnBlur
                  />
                  <savedIndicator.component />
                </div>
              )}
            />
          </form>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,6rem),1fr))] gap-2">
            <For each={getOptions(ConfigSchema.shape.paceCaret)}>
              {(option) => {
                const optionMeta = configMetadata.paceCaret
                  .optionsMetadata as Record<
                  string,
                  { displayString?: string }
                >;
                const displayString =
                  optionMeta?.[option]?.displayString ?? option;
                return (
                  <Button
                    active={getConfig.paceCaret === option}
                    onClick={() => {
                      if (getConfig.paceCaret === option) return;
                      setConfig("paceCaret", option);
                    }}
                  >
                    <SettingsSearchMatch text={displayString} />
                  </Button>
                );
              }}
            </For>
          </div>
        </div>
      }
    />
  );
}

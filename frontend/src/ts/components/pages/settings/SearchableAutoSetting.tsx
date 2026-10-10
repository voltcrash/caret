import { Config, ConfigKey, ConfigSchema } from "@oxytype/schemas/configs";
import { createForm } from "@tanstack/solid-form";
import { For, JSXElement } from "solid-js";
import { z } from "zod/v3";

import {
  configMetadata,
  getOptionLabel,
  getOptionSearchKeywords,
  getVisibleOptions,
} from "../../../config/metadata";
import { setConfig } from "../../../config/setters";
import { getConfig } from "../../../config/store";
import { useSavedIndicator } from "../../../hooks/useSavedIndicator";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { InputField } from "../../ui/form/InputField";
import { fromSchema } from "../../ui/form/utils";
import { SearchableSetting } from "./SearchableSetting";
import { SettingsSearchMatch } from "./SettingsSearchMatch";

export function SearchableAutoSetting<T extends ConfigKey>(props: {
  key: T;
  inputs?: JSXElement;
  wide?: boolean;
  onOptionClick?: (value: Config[T]) => void;
}): JSXElement {
  const savedIndicator = useSavedIndicator();

  // five or more options don't fit next to the description without wrapping
  // their labels, so they get a full-width row like explicitly wide settings
  const hasManyOptions = (): boolean =>
    (getVisibleOptions(props.key)?.length ?? 0) >= 5;
  const isWide = (): boolean => props.wide === true || hasManyOptions();

  const form = createForm(() => ({
    defaultValues: {
      [props.key]: getConfig[props.key],
    },
    onSubmit: ({ value }) => {
      const val = value[props.key];
      if (val === getConfig[props.key]) return;
      savedIndicator.flash();
      setConfig(props.key, val as Config[T]);
    },
  }));

  const autoInputs = () => {
    if (
      ConfigSchema.shape[props.key]._def.typeName ===
      z.ZodFirstPartyTypeKind.ZodNumber
    ) {
      return (
        <div class="grid w-full gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field
              //@ts-expect-error -- i think because props.key is a key of config, which is a zod schema, the typechecker gives up (too complex to infer or something)
              name={props.key}
              validators={{
                onChange: fromSchema(
                  ConfigSchema.shape[props.key] as z.ZodNumber,
                ),
                onBlur: () => {
                  void form.handleSubmit();
                },
              }}
              children={(field) => (
                <div class="relative">
                  <InputField
                    field={field}
                    schema={ConfigSchema.shape[props.key]}
                    placeholder={
                      configMetadata[props.key].displayString ?? props.key
                    }
                    type="number"
                    resetToDefaultIfEmptyOnBlur
                  />
                  <savedIndicator.component />
                </div>
              )}
            />
          </form>
        </div>
      );
    }

    const options = getVisibleOptions(props.key);

    if (options !== undefined) {
      return (
        <div
          class={cn(
            // min() keeps a track from exceeding narrow (320px) containers
            "grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,4.5rem),1fr))] gap-2",
            // 4 options don't fit in one row of the input column, so use a 2x2
            // grid instead of leaving a single option on its own row
            options.length === 4 && "grid-cols-2",
            // labels stay on one line; rows fill up and stretch to full width
            hasManyOptions() && !props.wide && "flex flex-wrap",
            props.wide &&
              "grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,13.5rem),1fr))]",
          )}
        >
          <For each={options}>
            {(option) => (
              <Button
                class={cn(
                  hasManyOptions() && !props.wide && "flex-1 whitespace-nowrap",
                )}
                active={getConfig[props.key] === option}
                onClick={() => {
                  if (getConfig[props.key] === option) return;
                  props.onOptionClick?.(option);
                  setConfig(props.key, option);
                }}
              >
                <SettingsSearchMatch text={getOptionLabel(props.key, option)} />
              </Button>
            )}
          </For>
        </div>
      );
    }
    return undefined;
  };

  return (
    <SearchableSetting
      key={props.key}
      title={configMetadata[props.key].displayString ?? props.key}
      fa={configMetadata[props.key].fa}
      description={configMetadata[props.key].description}
      extraSearchKeywords={getOptionSearchKeywords(props.key)}
      onReset={() => form.reset({ [props.key]: getConfig[props.key] })}
      inputs={!isWide() ? autoInputs() : props.inputs}
      fullWidthInputs={isWide() ? (autoInputs() ?? props.inputs) : props.inputs}
    />
  );
}

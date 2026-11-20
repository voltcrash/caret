import { MinimumBurstCustomSpeedSchema } from "@caret/schemas/configs";
import { createForm } from "@tanstack/solid-form";
import { JSXElement } from "solid-js";

// import { showSuccessNotification } from "#shared/states/notifications.ts";
import { Button } from "#shared/components/common/Button.tsx";
import { InputField } from "#shared/components/ui/form/InputField.tsx";
import { fromSchema } from "#shared/components/ui/form/utils.ts";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";

import { useSavedIndicator } from "../../hooks/useSavedIndicator";
import { SearchableSetting } from "../SearchableSetting";

export function MinBurst(): JSXElement {
  const savedIndicator = useSavedIndicator();

  const form = createForm(() => ({
    defaultValues: {
      minBurstCustomSpeed: getConfig.minBurstCustomSpeed,
    },
    onSubmit: ({ value }) => {
      const val = value.minBurstCustomSpeed;
      if (val === getConfig.minBurstCustomSpeed) return;
      if (getConfig.minBurst !== "off") {
        //
      } else {
        setConfig("minBurst", "fixed");
      }
      savedIndicator.flash();
      setConfig("minBurstCustomSpeed", val);
    },
  }));

  return (
    <SearchableSetting
      key="minBurst"
      resetKeys={["minBurstCustomSpeed", "minBurst"]}
      onReset={() =>
        form.reset({ minBurstCustomSpeed: getConfig.minBurstCustomSpeed })
      }
      title={configMetadata.minBurst.displayString ?? "min burst"}
      fa={configMetadata.minBurst.fa}
      description={configMetadata.minBurst.description}
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
              name="minBurstCustomSpeed"
              validators={{
                onChange: fromSchema(MinimumBurstCustomSpeedSchema),
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
                    schema={MinimumBurstCustomSpeedSchema}
                    placeholder={
                      configMetadata.minBurst.displayString ?? "min burst"
                    }
                    type="number"
                    resetToDefaultIfEmptyOnBlur
                  />
                  <savedIndicator.component />
                </div>
              )}
            />
          </form>
          {/* <input class="w-full" value={inputValue()} /> */}
          <div class="grid grid-cols-3 gap-2">
            <Button
              active={getConfig.minBurst === "off"}
              onClick={() => {
                if (getConfig.minBurst === "off") return;
                setConfig("minBurst", "off");
              }}
            >
              off
            </Button>
            <Button
              active={getConfig.minBurst === "fixed"}
              onClick={() => {
                if (getConfig.minBurst === "fixed") return;
                setConfig("minBurst", "fixed");
              }}
            >
              fixed
            </Button>
            <Button
              active={getConfig.minBurst === "flex"}
              onClick={() => {
                if (getConfig.minBurst === "flex") return;
                setConfig("minBurst", "flex");
              }}
            >
              flex
            </Button>
          </div>
        </div>
      }
    />
  );
}

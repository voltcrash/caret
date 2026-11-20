import { createForm } from "@tanstack/solid-form";
import { JSXElement } from "solid-js";
import { z } from "zod";

import { AnimatedModal } from "../../../ts/components/common/AnimatedModal";
import { InputField } from "../../../ts/components/ui/form/InputField";
import { SubmitButton } from "../../../ts/components/ui/form/SubmitButton";
import { fromSchema } from "../../../ts/components/ui/form/utils";
import { setConfig } from "../../../ts/config/setters";
import { getConfig } from "../../../ts/config/store";
import { hideModalAndClearChain } from "../../../ts/states/modals";
import { showNoticeNotification } from "../../../ts/states/notifications";
import { restartTest } from "../../../ts/typing-host";
import { getBailOutHint } from "../../../ts/utils/bail-out";

export function CustomWordAmountModal(): JSXElement {
  const form = createForm(() => ({
    defaultValues: {
      words: getConfig.words,
    },
    onSubmit: ({ value }) => {
      const val = value.words;
      setConfig("words", val);
      restartTest();

      if (val > 2000) {
        showNoticeNotification("Stay safe and take breaks!");
      } else if (val === 0) {
        showNoticeNotification(`Infinite words! ${getBailOutHint()}`, {
          durationMs: 7000,
        });
      }

      hideModalAndClearChain("CustomWordAmount");
    },
  }));

  return (
    <AnimatedModal
      id="CustomWordAmount"
      title="Custom word amount"
      focusFirstInput="focusAndSelect"
      beforeShow={() => {
        form.reset({ words: getConfig.words });
      }}
    >
      <form
        class="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="words"
          validators={{
            onChange: fromSchema(
              z.number().nonnegative().max(Number.MAX_SAFE_INTEGER),
            ),
          }}
          children={(field) => (
            <InputField
              field={field}
              type="number"
              min={0}
              step={1}
              placeholder="word amount"
            />
          )}
        />
        <div class="text-xs">
          You can start an infinite test by inputting 0.{" "}
          <span class="pointer-coarse:hidden">
            Then, to stop the test, use the Bail Out feature:
            <br />(<kbd>esc</kbd> or <kbd>ctrl/cmd</kbd> + <kbd>shift</kbd> +{" "}
            <kbd>p</kbd> &gt; Bail Out)
          </span>
          <span class="hidden pointer-coarse:inline">
            Then, to stop the test, tap end test under the words.
          </span>
        </div>
        <SubmitButton
          form={form}
          variant="button"
          text="apply"
          skipUnchangedCheck
        />
      </form>
    </AnimatedModal>
  );
}

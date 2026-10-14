import { JSXElement, Show } from "solid-js";

import type { CustomTextController } from "./createCustomTextController";

import { showModal } from "../../../states/modals";
import { Button } from "../../common/Button";
import { SubmitButton } from "../../ui/form/SubmitButton";
import { TextareaField } from "../../ui/form/TextareaField";

export function CustomTextEditor(props: {
  controller: CustomTextController;
}): JSXElement {
  return (
    <div class="row-start-1 grid gap-4">
      {/* Top buttons row 1 */}
      <div class="grid grid-cols-2 gap-4">
        <Button
          variant="button"
          fa={{ icon: "fa-save" }}
          text="save"
          onClick={() => {
            props.controller.setTextToSave(props.controller.cleanUpText());
            showModal("SaveCustomText");
          }}
        />
        <Button
          variant="button"
          fa={{ icon: "fa-folder" }}
          text="saved texts"
          onClick={() => showModal("SavedTexts")}
        />
      </div>

      {/* Textarea */}
      <div class="relative lg:col-start-1">
        <Show when={props.controller.longTextWarning()}>
          <div
            class="absolute inset-0 z-10 grid cursor-pointer place-items-center rounded bg-sub-alt text-center"
            onClick={() => props.controller.setLongTextWarning(false)}
          >
            <div>
              <p class="text-em-xl">
                A long custom text is currently loaded.
                <br />
                Editing the text will disable progress tracking.
              </p>
              <p class="mt-4 text-em-xs text-sub">
                Click anywhere to start editing the text.
              </p>
            </div>
          </div>
        </Show>
        <Show when={props.controller.challengeWarning()}>
          <div
            class="absolute inset-0 z-10 grid cursor-pointer place-items-center rounded bg-sub-alt text-center"
            onClick={() => props.controller.setChallengeWarning(false)}
          >
            <div>
              <p class="text-em-xl">
                A challenge is currently loaded.
                <br />
                Editing the settings will clear the challenge.
              </p>
              <p class="mt-4 text-em-xs text-sub">Click anywhere to edit.</p>
            </div>
          </div>
        </Show>
        <props.controller.form.Field name="text">
          {(field) => (
            <TextareaField
              field={field}
              ref={props.controller.textareaRef}
              placeholder="type or paste your custom text"
              class="min-h-48 self-start overflow-x-hidden overflow-y-scroll p-4 text-base font-(--font) text-text lg:min-h-182.5"
              onKeyDown={props.controller.handleTextareaKeydown}
              onKeyPress={props.controller.handleTextareaKeypress}
            />
          )}
        </props.controller.form.Field>
      </div>
      <SubmitButton
        form={props.controller.form}
        skipUnchangedCheck
        variant="button"
        text="ok"
        class="lg:col-start-1"
        disabled={props.controller.isDisabled()}
      />
    </div>
  );
}

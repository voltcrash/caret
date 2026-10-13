import { createCustomTextController } from "./custom-text/createCustomTextController";
import { CustomTextSettings } from "./custom-text/CustomTextSettings";

export { type CustomTextIncomingData } from "./custom-text/types";

import { JSXElement, Show } from "solid-js";

import { showModal } from "../../states/modals";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { Separator } from "../common/Separator";
import { SubmitButton } from "../ui/form/SubmitButton";
import { TextareaField } from "../ui/form/TextareaField";
import { CustomGeneratorModal } from "./CustomGeneratorModal";
import { SaveCustomTextModal } from "./SaveCustomTextModal";
import { SavedTextsModal } from "./SavedTextsModal";
import { WordFilterModal } from "./WordFilterModal";

export function CustomTextModal(): JSXElement {
  const controller = createCustomTextController();
  const {
    longTextWarning,
    setLongTextWarning,
    challengeWarning,
    setChallengeWarning,
    setIncomingChainedData,
    textToSave,
    setTextToSave,
    form,
    isDisabled,
    cleanUpText,
    handleTextareaKeydown,
    handleTextareaKeypress,
    beforeShow,
    afterShow,
    textareaRef,
  } = controller;
  return (
    <>
      <AnimatedModal
        id="CustomText"
        modalClass="max-w-[1200px] lg:grid-cols-[auto_20rem] grid-cols-1 h-min"
        beforeShow={beforeShow}
        afterShow={afterShow}
      >
        <form
          class="contents"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <Separator class="row-start-2 block lg:hidden" />
          <div class="row-start-1 grid gap-4">
            {/* Top buttons row 1 */}
            <div class="grid grid-cols-2 gap-4">
              <Button
                variant="button"
                fa={{ icon: "fa-save" }}
                text="save"
                onClick={() => {
                  setTextToSave(cleanUpText());
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
              <Show when={longTextWarning()}>
                <div
                  class="absolute inset-0 z-10 grid cursor-pointer place-items-center rounded bg-sub-alt text-center"
                  onClick={() => setLongTextWarning(false)}
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
              <Show when={challengeWarning()}>
                <div
                  class="absolute inset-0 z-10 grid cursor-pointer place-items-center rounded bg-sub-alt text-center"
                  onClick={() => setChallengeWarning(false)}
                >
                  <div>
                    <p class="text-em-xl">
                      A challenge is currently loaded.
                      <br />
                      Editing the settings will clear the challenge.
                    </p>
                    <p class="mt-4 text-em-xs text-sub">
                      Click anywhere to edit.
                    </p>
                  </div>
                </div>
              </Show>
              <form.Field name="text">
                {(field) => (
                  <TextareaField
                    field={field}
                    ref={textareaRef}
                    placeholder="type or paste your custom text"
                    class="min-h-48 self-start overflow-x-hidden overflow-y-scroll p-4 text-base font-(--font) text-text lg:min-h-182.5"
                    onKeyDown={handleTextareaKeydown}
                    onKeyPress={handleTextareaKeypress}
                  />
                )}
              </form.Field>
            </div>
            <SubmitButton
              form={form}
              skipUnchangedCheck
              variant="button"
              text="ok"
              class="lg:col-start-1"
              disabled={isDisabled()}
            />
          </div>

          {/* Settings sidebar — stacks below the textarea on small screens, column 2 on large screens */}
          <CustomTextSettings controller={controller} />
        </form>
      </AnimatedModal>
      <SaveCustomTextModal textToSave={textToSave} />
      <SavedTextsModal setChainedData={setIncomingChainedData} />
      <WordFilterModal setChainedData={setIncomingChainedData} />
      <CustomGeneratorModal setChainedData={setIncomingChainedData} />
    </>
  );
}

import { createCustomTextController } from "./custom-text/createCustomTextController";
import { modeOptions, delimiterOptions } from "./custom-text/options";

export { type CustomTextIncomingData } from "./custom-text/types";

import { For, JSXElement, Show } from "solid-js";

import { showModal } from "../../states/modals";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { Separator } from "../common/Separator";
import { SubmitButton } from "../ui/form/SubmitButton";
import { TextareaField } from "../ui/form/TextareaField";
import { SettingsGroup } from "./custom-text/SettingsGroup";
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
    formValues,
    isDisabled,
    isLimitDisabled,
    showWordLimit,
    showSectionLimit,
    cleanUpText,
    applyRemoveZeroWidth,
    applyRemoveFancyTypography,
    applyReplaceControlChars,
    applyReplaceNewlines,
    handleDelimiterChange,
    handleFileOpen,
    handleTextareaKeydown,
    handleTextareaKeypress,
    handleModeChange,
    beforeShow,
    afterShow,
    fileInputRef,
    textareaRef,
    openFile,
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
          <div
            class={cn(
              "row-start-3 grid h-min gap-4 text-xs lg:row-start-auto",
              isDisabled() && "pointer-events-none opacity-50 select-none",
            )}
          >
            <SettingsGroup
              title="Mode"
              icon="fa-cog"
              sub="Change the way words are generated."
            >
              <div class="flex w-full gap-2">
                <For each={modeOptions}>
                  {(opt) => (
                    <Button
                      variant="button"
                      text={opt.label}
                      class="flex-1"
                      active={formValues().mode === opt.value}
                      onClick={() => handleModeChange(opt.value)}
                    />
                  )}
                </For>
              </div>
            </SettingsGroup>

            <SettingsGroup
              title="Limit"
              icon="fa-step-forward"
              sub="Control how many words to generate or for how long you want to type."
            >
              <div class={cn("flex w-full items-center gap-4")}>
                <form.Field name="limitWord">
                  {(field) => (
                    <input
                      type="number"
                      inputMode="numeric"
                      class={cn("w-full", !showWordLimit() && "hidden")}
                      min="0"
                      placeholder="words"
                      value={field().state.value}
                      disabled={isLimitDisabled()}
                      onInput={(e) => {
                        field().handleChange(e.currentTarget.value);
                        form.setFieldValue("limitTime", "");
                        form.setFieldValue("limitSection", "");
                      }}
                    />
                  )}
                </form.Field>
                <form.Field name="limitSection">
                  {(field) => (
                    <input
                      type="number"
                      inputMode="numeric"
                      class={cn("w-full", !showSectionLimit() && "hidden")}
                      min="0"
                      placeholder="sections"
                      value={field().state.value}
                      disabled={isLimitDisabled()}
                      onInput={(e) => {
                        field().handleChange(e.currentTarget.value);
                        form.setFieldValue("limitWord", "");
                        form.setFieldValue("limitTime", "");
                      }}
                    />
                  )}
                </form.Field>
                <span class="text-sub">or</span>
                <form.Field name="limitTime">
                  {(field) => (
                    <input
                      type="number"
                      inputMode="numeric"
                      class="w-full"
                      min="0"
                      placeholder="time"
                      value={field().state.value}
                      disabled={isLimitDisabled()}
                      onInput={(e) => {
                        field().handleChange(e.currentTarget.value);
                        form.setFieldValue("limitWord", "");
                        form.setFieldValue("limitSection", "");
                      }}
                    />
                  )}
                </form.Field>
              </div>
            </SettingsGroup>

            <SettingsGroup
              title="Word delimiter"
              icon="fa-grip-lines-vertical"
              sub="Change how words are separated. Using the pipe delimiter allows you to randomize groups of words."
            >
              <div class="flex w-full gap-2">
                <For each={delimiterOptions}>
                  {(opt) => (
                    <Button
                      variant="button"
                      text={opt.label}
                      class="flex-1"
                      active={
                        formValues().pipeDelimiter === (opt.value === "true")
                      }
                      onClick={() =>
                        handleDelimiterChange(opt.value === "true")
                      }
                    />
                  )}
                </For>
              </div>
            </SettingsGroup>
            <Separator />
            <div class="grid gap-2">
              <input
                ref={fileInputRef}
                type="file"
                class="hidden"
                accept=".txt"
                onChange={handleFileOpen}
              />
              <Button
                variant="button"
                fa={{ icon: "fa-file-import" }}
                text="open file"
                onClick={openFile}
              />
              <Button
                variant="button"
                fa={{ icon: "fa-filter" }}
                text="words filter"
                onClick={() => showModal("WordFilter")}
              />
              <Button
                variant="button"
                fa={{ icon: "fa-cogs" }}
                text="custom generator"
                onClick={() => showModal("CustomGenerator")}
              />
            </div>
            {/* <Separator /> */}
            <SettingsGroup
              title="Remove zero-width characters"
              icon="fa-text-width"
              sub="Fully remove zero-width characters."
            >
              <Button
                variant="button"
                text="apply"
                class="w-full"
                onClick={applyRemoveZeroWidth}
              />
            </SettingsGroup>

            <SettingsGroup
              title="Remove fancy typography"
              icon="fa-pen-fancy"
              sub={
                'Standardises typography symbols (for example \u201c and \u201d become ")'
              }
            >
              <Button
                variant="button"
                text="apply"
                class="w-full"
                onClick={applyRemoveFancyTypography}
              />
            </SettingsGroup>

            <SettingsGroup
              title="Replace control characters"
              icon="fa-code"
              sub="Replace control characters (\n becomes a new line and \t becomes a tab)"
            >
              <Button
                variant="button"
                text="apply"
                class="w-full"
                onClick={applyReplaceControlChars}
              />
            </SettingsGroup>

            <SettingsGroup
              title="Replace new lines with spaces"
              icon="fa-level-down-alt"
              iconClass="fa-rotate-90"
              sub="Replace all new line characters with spaces. Can automatically add periods to the end of lines if you wish."
            >
              <div class="flex w-full gap-2">
                <Button
                  variant="button"
                  text="space"
                  class="flex-1"
                  onClick={() => applyReplaceNewlines("space")}
                />
                <Button
                  variant="button"
                  text="period + space"
                  class="flex-1"
                  onClick={() => applyReplaceNewlines("periodSpace")}
                />
              </div>
            </SettingsGroup>
          </div>
        </form>
      </AnimatedModal>
      <SaveCustomTextModal textToSave={textToSave} />
      <SavedTextsModal setChainedData={setIncomingChainedData} />
      <WordFilterModal setChainedData={setIncomingChainedData} />
      <CustomGeneratorModal setChainedData={setIncomingChainedData} />
    </>
  );
}

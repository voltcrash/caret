import { For, JSXElement } from "solid-js";

import type { CustomTextController } from "./createCustomTextController";

import { showModal } from "../../../states/modals";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { Separator } from "../../common/Separator";
import { modeOptions, delimiterOptions } from "./options";
import { SettingsGroup } from "./SettingsGroup";

export function CustomTextSettings(props: {
  controller: CustomTextController;
}): JSXElement {
  return (
    <div
      class={cn(
        "row-start-3 grid h-min gap-4 text-xs lg:row-start-auto",
        props.controller.isDisabled() &&
          "pointer-events-none opacity-50 select-none",
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
                active={props.controller.formValues().mode === opt.value}
                onClick={() => props.controller.handleModeChange(opt.value)}
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
          <props.controller.form.Field name="limitWord">
            {(field) => (
              <input
                type="number"
                inputMode="numeric"
                class={cn(
                  "w-full",
                  !props.controller.showWordLimit() && "hidden",
                )}
                min="0"
                placeholder="words"
                value={field().state.value}
                disabled={props.controller.isLimitDisabled()}
                onInput={(e) => {
                  field().handleChange(e.currentTarget.value);
                  props.controller.form.setFieldValue("limitTime", "");
                  props.controller.form.setFieldValue("limitSection", "");
                }}
              />
            )}
          </props.controller.form.Field>
          <props.controller.form.Field name="limitSection">
            {(field) => (
              <input
                type="number"
                inputMode="numeric"
                class={cn(
                  "w-full",
                  !props.controller.showSectionLimit() && "hidden",
                )}
                min="0"
                placeholder="sections"
                value={field().state.value}
                disabled={props.controller.isLimitDisabled()}
                onInput={(e) => {
                  field().handleChange(e.currentTarget.value);
                  props.controller.form.setFieldValue("limitWord", "");
                  props.controller.form.setFieldValue("limitTime", "");
                }}
              />
            )}
          </props.controller.form.Field>
          <span class="text-sub">or</span>
          <props.controller.form.Field name="limitTime">
            {(field) => (
              <input
                type="number"
                inputMode="numeric"
                class="w-full"
                min="0"
                placeholder="time"
                value={field().state.value}
                disabled={props.controller.isLimitDisabled()}
                onInput={(e) => {
                  field().handleChange(e.currentTarget.value);
                  props.controller.form.setFieldValue("limitWord", "");
                  props.controller.form.setFieldValue("limitSection", "");
                }}
              />
            )}
          </props.controller.form.Field>
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
                  props.controller.formValues().pipeDelimiter ===
                  (opt.value === "true")
                }
                onClick={() =>
                  props.controller.handleDelimiterChange(opt.value === "true")
                }
              />
            )}
          </For>
        </div>
      </SettingsGroup>
      <Separator />
      <div class="grid gap-2">
        <input
          ref={props.controller.fileInputRef}
          type="file"
          class="hidden"
          accept=".txt"
          onChange={() => props.controller.handleFileOpen()}
        />
        <Button
          variant="button"
          fa={{ icon: "fa-file-import" }}
          text="open file"
          onClick={props.controller.openFile}
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
          onClick={props.controller.applyRemoveZeroWidth}
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
          onClick={props.controller.applyRemoveFancyTypography}
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
          onClick={props.controller.applyReplaceControlChars}
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
            onClick={() => props.controller.applyReplaceNewlines("space")}
          />
          <Button
            variant="button"
            text="period + space"
            class="flex-1"
            onClick={() => props.controller.applyReplaceNewlines("periodSpace")}
          />
        </div>
      </SettingsGroup>
    </div>
  );
}

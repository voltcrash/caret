import { AnyFieldApi } from "@tanstack/solid-form";
import { Accessor, JSXElement, Show, useContext } from "solid-js";

import { cn } from "../../../utils/cn";
import { FieldLabelContext } from "./field-label";
import { FieldIndicator } from "./FieldIndicator";

export function TextareaField(props: {
  field: Accessor<AnyFieldApi>;
  ref?: HTMLTextAreaElement | ((el: HTMLTextAreaElement) => void);
  placeholder?: string;
  label?: string;
  autofocus?: boolean;
  autocomplete?: string;
  disabled?: boolean;
  class?: string;
  maxLength?: number;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyPress?: (e: KeyboardEvent) => void;
}): JSXElement {
  const standaloneLabel = (): string => {
    const placeholder = props.placeholder?.trim();
    return placeholder !== undefined && placeholder !== ""
      ? placeholder
      : (props.field().name as string).replace(/([a-z])([A-Z])/g, "$1 $2");
  };
  const inheritedLabel = useContext(FieldLabelContext);
  return (
    <div class="grid w-full">
      <textarea
        autofocus={props.autofocus}
        ref={props.ref}
        class={cn(
          "col-start-1 row-start-1 w-full resize-y",
          "rounded border-none bg-sub-alt p-[0.5em] text-em-base leading-[1.25em] caret-main outline-none",
          "focus-visible:shadow-[0_0_0_0.1rem_var(--bg-color),0_0_0_0.2rem_var(--text-color)]",
          props.field().options.validators ? "pr-[1.85em]" : "",
          props.class,
        )}
        id={props.field().name as string}
        aria-label={props.label ?? inheritedLabel?.() ?? standaloneLabel()}
        name={props.field().name as string}
        placeholder={props.placeholder ?? ""}
        autocomplete={props.autocomplete}
        value={props.field().state.value as string}
        onBlur={() => props.field().handleBlur()}
        onInput={(e) => props.field().handleChange(e.currentTarget.value)}
        disabled={props.disabled}
        maxLength={props.maxLength}
        onKeyDown={(e) => props.onKeyDown?.(e)}
        onKeyPress={(e) => props.onKeyPress?.(e)}
        dir="auto"
      ></textarea>
      <Show when={props.field().options.validators}>
        <FieldIndicator field={props.field()} />
      </Show>
    </div>
  );
}

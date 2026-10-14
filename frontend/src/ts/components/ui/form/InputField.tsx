import { AnyFieldApi } from "@tanstack/solid-form";
import { format as dateFormat } from "date-fns/format";
import { Accessor, createSignal, JSXElement, Show, useContext } from "solid-js";
import { ZodDate, ZodFirstPartyTypeKind, ZodNumber, ZodTypeAny } from "zod/v3";

import { cn } from "../../../utils/cn";
import { getZodType, unwrapSchema } from "../../../utils/zod";
import { FieldLabelContext } from "./field-label";
import { FieldIndicator } from "./FieldIndicator";

// phones: a number pad instead of the full keyboard for number fields. the
// ios number pad has no minus key, so fields allowing negatives keep the
// default keyboard. Only use a number pad for nonnegative fields.
function getNumberInputMode(
  type: string | undefined,
  min: number | undefined,
  step: string | number | undefined,
): "numeric" | "decimal" | undefined {
  if (type !== "number") return undefined;
  if (min === undefined || min < 0) return undefined;
  if (step === undefined || Number.isInteger(Number(step))) return "numeric";
  return "decimal";
}

export function InputField(props: {
  field: Accessor<AnyFieldApi>;
  placeholder?: string;
  label?: string;
  autocomplete?: string;
  inputMode?:
    | "none"
    | "text"
    | "email"
    | "numeric"
    | "decimal"
    | "search"
    | "tel"
    | "url";
  autoCapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
  spellCheck?: boolean;
  type?: string;
  disabled?: boolean;
  readOnly?: boolean;
  clickToSelect?: boolean;
  class?: string;
  dir?: "ltr" | "rtl" | "auto";
  maxLength?: number;
  onFocus?: () => void;
  /**
   * If user inputs empty string the field is resetted to the default value
   */
  resetToDefaultIfEmptyOnBlur?: boolean;
  schema?: ZodTypeAny;
  min?: number;
  max?: number;
  step?: string | number;
  alwaysShowFieldIndicator?: boolean;
}): JSXElement {
  const standaloneLabel = (): string => {
    const placeholder = props.placeholder?.trim();
    return placeholder !== undefined && placeholder !== ""
      ? placeholder
      : (props.field().name as string).replace(/([a-z])([A-Z])/g, "$1 $2");
  };
  const inheritedLabel = useContext(FieldLabelContext);
  const [shake, setShake] = createSignal(false);
  const numberOptions = () => getNumberOptions(props.schema);

  const shakeItIfYouWantIt = () => {
    if (
      props.field().state.meta.isTouched &&
      !props.field().state.meta.isValid
    ) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }
  };

  const formatDate = (date: Date | undefined) =>
    date === undefined
      ? undefined
      : dateFormat(
          date,
          props.type === "date" ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm:ss",
        );

  return (
    <div
      class="grid w-full"
      style={
        shake() ? { animation: "shake 0.1s ease-in-out infinite" } : undefined
      }
    >
      <input
        class={cn(
          "col-start-1 row-start-1 w-full",
          "rounded border-none bg-sub-alt p-[0.5em] text-em-base leading-[1.25em] caret-main outline-none",
          "focus-visible:shadow-[0_0_0_0.1rem_var(--bg-color),0_0_0_0.2rem_var(--text-color)]",
          "autofill-fix",
          props.field().options.validators ? "pr-[1.85em]" : "",
          props.class,
        )}
        type={props.type ?? "text"}
        aria-label={props.label ?? inheritedLabel?.() ?? standaloneLabel()}
        id={props.field().name as string}
        placeholder={props.placeholder ?? ""}
        autocomplete={props.autocomplete}
        // phones: number pad instead of the full keyboard for number fields
        inputMode={
          props.inputMode ??
          getNumberInputMode(
            props.type,
            props.min ?? numberOptions().min,
            props.step ?? numberOptions().step,
          )
        }
        autoCapitalize={props.autoCapitalize}
        spellcheck={props.spellCheck}
        name={props.field().name as string}
        value={convertValueToString(props.field().state.value)}
        onBlur={() => {
          if (
            props.resetToDefaultIfEmptyOnBlur &&
            (props.field().state.value === undefined ||
              props.field().state.value === "")
          ) {
            props.field().setValue(getDefaultFieldValue(props.field()));
          }
          shakeItIfYouWantIt();
          props.field().handleBlur();
        }}
        onInput={(e) => {
          const value: unknown = convertStringToValue(
            props.field(),
            e.target.value,
          );
          props.field().handleChange(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            shakeItIfYouWantIt();
          }
        }}
        disabled={props.disabled}
        readOnly={props.readOnly}
        onClick={(e) => {
          if (props.clickToSelect) e.currentTarget.select();
        }}
        onFocus={() => props.onFocus?.()}
        dir={props.dir}
        maxLength={props.maxLength}
        {...numberOptions()}
        {...getDateOptions(props.schema, formatDate)}
        min={props.min}
        max={props.max}
        step={props.step?.toString()}
      />
      <Show when={props.field().options.validators}>
        <FieldIndicator
          field={props.field()}
          alwaysShow={props.alwaysShowFieldIndicator}
        />
      </Show>
    </div>
  );
}

function getNumberOptions(rawSchema: ZodTypeAny | undefined): {
  min?: number;
  max?: number;
  step?: string;
} {
  if (rawSchema === undefined) return {};
  const schema = unwrapSchema(rawSchema);
  if (getZodType(schema) !== ZodFirstPartyTypeKind.ZodNumber) return {};
  const numberSchema = schema as ZodNumber;

  return {
    min: numberSchema.minValue ?? undefined,
    max: numberSchema.maxValue ?? undefined,
    step: numberSchema.isInt ? "1" : "any",
  };
}

function getDateOptions(
  rawSchema: ZodTypeAny | undefined,
  format: (val: Date | undefined) => string | undefined,
): {
  min?: string;
  max?: string;
} {
  if (rawSchema === undefined) return {};
  const schema = unwrapSchema(rawSchema);
  if (getZodType(schema) !== ZodFirstPartyTypeKind.ZodDate) return {};

  const applyFormat = (it: Date | null) =>
    it === null ? undefined : format(it);

  return {
    min: applyFormat((schema as ZodDate).minDate),
    max: applyFormat((schema as ZodDate).maxDate),
  };
}

function convertValueToString(input: unknown | undefined): string {
  if (input === undefined || input === null) return "";
  if (typeof input === "number") {
    if (isFinite(input)) return input.toString();
    else return "";
  }
  return input as string;
}

function convertStringToValue<T extends unknown | undefined>(
  field: AnyFieldApi,
  newValue: string,
): T | undefined {
  const defaultValue = getDefaultFieldValue(field);
  if (defaultValue === undefined || defaultValue === null) return newValue as T;
  if (newValue === "" && typeof defaultValue !== "string") return undefined;
  if (typeof defaultValue === "number") return Number.parseFloat(newValue) as T;

  return newValue as T;
}

function getDefaultFieldValue(field: AnyFieldApi): unknown {
  const defaults = field.form.options.defaultValues as
    | Record<string, unknown>
    | undefined;
  return defaults?.[field.name as string];
}

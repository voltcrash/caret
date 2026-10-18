import { createAppSignal } from "../../app/state";

import { showModal, hideModal } from "./modals";
import { AddNotificationOptions } from "./notifications";

import { Validation } from "../types/validation";
import { MessageContent } from "../types/message-content";
import { z } from "zod";

type InferSchema<T extends z.ZodType> = z.infer<T>;

type CommonInput<TType, TValue> = {
  type: TType;
  name?: string;
  initVal?: TValue;
  placeholder?: string;
  hidden?: boolean;
  disabled?: boolean;
  label?: string;
  class?: string;
  oninput?: (event: Event) => void;
  /**
   * preprocess is applied before validation and execFn
   * @param value
   * @returns
   */
  preprocess?: (value: TValue) => TValue;
  validation?: Omit<Validation<TValue>, "schema">;
};

// strings
type TextInput<T extends string> = {
  readOnly?: boolean;
  clickToSelect?: boolean;
} & CommonInput<"text", T>;

type TextArea<T extends string> = {
  readOnly?: boolean;
  clickToSelect?: boolean;
} & CommonInput<"textarea", T>;

type PasswordInput<T extends string> = CommonInput<"password", T>;
type EmailInput<T extends string> = CommonInput<"email", T>;

type StringTypeInput<T extends string> =
  | TextInput<T>
  | TextArea<T>
  | PasswordInput<T>
  | EmailInput<T>;

// numbers
type NumberInput<T extends number> = CommonInput<"number", T>;
type RangeInput<T extends number> = {
  step?: number;
} & CommonInput<"range", T>;

type NumberTypeInput<T extends number> = NumberInput<T> | RangeInput<T>;

// booleans
type CheckboxInput<T extends boolean> = {
  label: string;
  placeholder?: never;
  description?: string;
} & CommonInput<"checkbox", T>;

type BooleanTypeInput<T extends boolean> = CheckboxInput<T>;

// dates

type DateInput<T extends Date> = CommonInput<"date", T>;
type DateTimeInput<T extends Date> = CommonInput<"datetime-local", T>;
type DateTypeInput<T extends Date> = DateInput<T> | DateTimeInput<T>;

export type SimpleModalInput<T> = T extends string
  ? StringTypeInput<T>
  : T extends number
    ? NumberTypeInput<T>
    : T extends boolean
      ? BooleanTypeInput<T>
      : T extends Date
        ? DateTypeInput<T>
        : never;

export type GenericSimpleModalInput = CommonInput<
  SimpleModalInput<string | number | boolean | Date>["type"],
  unknown
> & {
  readOnly?: boolean;
  clickToSelect?: boolean;
  step?: number;
  description?: string;
};

type ModalSchema = z.ZodObject<z.ZodRawShape>;

export type ExecReturn = {
  status: "success" | "notice" | "error";
  afterHide?: () => void;
  alwaysHide?: boolean;
} & (
  | {
      message?: never;
      showNotification: false;
      notificationOptions?: never;
    }
  | {
      message: string;
      showNotification?: never;
      notificationOptions?: AddNotificationOptions;
    }
);

type InputsFromSchema<S extends ModalSchema> = {
  [K in keyof S["shape"]]: SimpleModalInput<z.infer<S["shape"][K]>>;
};

type SimpleModalOptions = {
  title: string;
  text?: MessageContent;
  textClass?: string;
  buttonText?: string;
  buttonAlwaysEnabled?: boolean;

  focusFirstInput?: true | "focusAndSelect";
  class?: string;
};

export type SimpleModalConfig<S extends ModalSchema> = SimpleModalOptions & {
  execFn: (values: InferSchema<S>) => Promise<ExecReturn>;
} & (
    | { schema: S; inputs: InputsFromSchema<S> }
    | { schema?: never; inputs?: never }
  );

type StoredSimpleModalConfig = SimpleModalOptions & {
  schema?: ModalSchema;
  inputs?: Record<string, GenericSimpleModalInput>;
  execFn: (values: Record<string, unknown>) => Promise<ExecReturn>;
};

const [simpleModalConfig, setSimpleModalConfig] =
  createAppSignal<StoredSimpleModalConfig | null>(null);

export { simpleModalConfig };

export function showSimpleModal<T extends ModalSchema>(
  config: SimpleModalConfig<T>,
): void {
  // Rendering crosses heterogeneous schemas; each configured input converts its own value.
  setSimpleModalConfig({
    ...config,
    inputs: config.inputs as
      | Record<string, GenericSimpleModalInput>
      | undefined,
    execFn: async (values) => config.execFn(values as InferSchema<T>),
  });
  showModal("SimpleModal");
}

export function hideSimpleModal(): void {
  hideModal("SimpleModal");
}

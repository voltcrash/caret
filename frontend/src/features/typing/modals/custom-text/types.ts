import type { CustomTextMode } from "@caret/schemas/util";

export type CustomTextIncomingData =
  | ({ set?: boolean; long?: boolean } & (
      | { text: string; splitText?: never }
      | { text?: never; splitText: string[] }
    ))
  | null;

export type Mode = "simple" | CustomTextMode;

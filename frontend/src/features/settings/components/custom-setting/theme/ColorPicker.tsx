import { debounce } from "@caret/util/timing";
import { JSXElement, onCleanup, untrack } from "solid-js";

import { Button } from "#shared/components/common/Button.tsx";
import { ColorName } from "#shared/constants/themes.ts";
import { getTheme, updateThemeColor } from "#shared/states/theme.ts";
import { cn } from "#shared/utils/cn.ts";

const COLOR_LABELS: Record<ColorName, string> = {
  bg: "background",
  main: "main",
  sub: "sub",
  subAlt: "sub alt",
  caret: "caret",
  text: "text",
  error: "error",
  errorExtra: "extra error",
  colorfulError: "error",
  colorfulErrorExtra: "extra error",
};

// Keep dynamic Tailwind classes statically discoverable.
const _pickerBgClasses = [
  "bg-(--picker-bg)",
  "bg-(--picker-main)",
  "bg-(--picker-caret)",
  "bg-(--picker-sub)",
  "bg-(--picker-subAlt)",
  "bg-(--picker-text)",
  "bg-(--picker-error)",
  "bg-(--picker-errorExtra)",
  "bg-(--picker-colorfulError)",
  "bg-(--picker-colorfulErrorExtra)",
];

export function ColorPicker(props: { color: ColorName }): JSXElement {
  let colorInputRef: HTMLInputElement | undefined = undefined;

  const text = (): string => COLOR_LABELS[props.color] ?? "unknown";

  const debouncedInput = debounce(125, (e: InputEvent) => {
    const target = e.target as HTMLInputElement;
    const color = target.value;
    const key = untrack(() => props.color);

    updateThemeColor(key, color);
  });
  // A pending edit must not land after the picker is gone (e.g. on reset).
  onCleanup(() => debouncedInput.cancel());

  return (
    <div
      class="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_min-content] items-center gap-2"
      style={{
        "--picker-bg": getTheme().bg,
        "--picker-main": getTheme().main,
        "--picker-caret": getTheme().caret,
        "--picker-sub": getTheme().sub,
        "--picker-subAlt": getTheme().subAlt,
        "--picker-text": getTheme().text,
        "--picker-error": getTheme().error,
        "--picker-errorExtra": getTheme().errorExtra,
        "--picker-colorfulError": getTheme().colorfulError,
        "--picker-colorfulErrorExtra": getTheme().colorfulErrorExtra,
      }}
    >
      <div>{text()}</div>
      <input
        aria-label={`${props.color} color value`}
        class="w-full"
        type="text"
        value={getTheme()[props.color]}
        onChange={(e) => {
          const value = e.currentTarget.value;
          if (!/^#([0-9A-Fa-f]{3}){1,2}$/.test(value)) {
            // invalid hex color
            e.currentTarget.value = getTheme()[props.color];
            return;
          }
          updateThemeColor(props.color, value);
        }}
      />
      <div class="grid">
        <input
          aria-label={`${props.color} color picker`}
          ref={(el) => (colorInputRef = el)}
          type="color"
          value={getTheme()[props.color]}
          onInput={debouncedInput}
          class="pointer-events-none col-[1/1] row-[1/1] m-0 h-full w-0 p-0 opacity-0"
        />
        <Button
          aria-label={`Choose ${props.color} color`}
          class={cn(
            `col-[1/1] row-[1/1]`,
            `bg-(--picker-${props.color}) text-(--picker-bg)`,
            `hover:bg-(--picker-text)`,
            props.color === "bg" && "bg-(--picker-subAlt) text-(--picker-text)",
            props.color === "subAlt" && "text-(--picker-text)",
          )}
          fa={{
            icon: "fa-palette",
            fixedWidth: true,
          }}
          onClick={() => colorInputRef?.click()}
        />
      </div>
    </div>
  );
}

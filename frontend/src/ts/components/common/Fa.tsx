import { JSXElement } from "solid-js";

import { icons } from "../../../components/icons/data";
import { FaObject } from "../../types/font-awesome";
import { cn } from "../../utils/cn";

export type FaProps = {
  fixedWidth?: boolean;
  spin?: boolean;
  size?: number;
  class?: string;
} & FaObject;

export function Fa(props: FaProps): JSXElement {
  const variant = (): string => props.variant ?? "solid";
  const glyph = (): { viewBox: string; path: string } | undefined => {
    const selected = icons[variant() as keyof typeof icons] as Record<
      string,
      { viewBox: string; path: string }
    >;
    // Banners retain legacy class strings, including the icon name and utilities.
    const name = props.icon
      .split(/\s+/)
      .find((part) => Object.hasOwn(selected, part));
    return name === undefined ? undefined : selected[name];
  };
  return (
    <i
      aria-hidden="true"
      class={cn(
        "inline-block w-[1.25em] text-center not-italic",
        props.icon,
        {
          fas: variant() === "solid",
          far: variant() === "regular",
          fab: variant() === "brand",
          "fa-fw": props.fixedWidth,
          "fa-spin": props.spin,
        },
        props.spin &&
          "animate-[spin_2s_linear_infinite] motion-reduce:animate-none",
        props.class,
      )}
      style={{
        "font-size": props.size !== undefined ? `${props.size}em` : undefined,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={glyph()?.viewBox}
        aria-hidden="true"
        class="inline-block h-[1em] w-full overflow-visible align-[-0.125em] fill-current"
        data-icon-license="Font Awesome Free 7.3.1, CC BY 4.0, Fonticons Inc."
      >
        <path d={glyph()?.path}></path>
      </svg>
    </i>
  );
}

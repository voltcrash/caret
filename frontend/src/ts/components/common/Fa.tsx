import { createIsomorphicFn } from "@tanstack/solid-start";
import { createEffect, createSignal, JSXElement, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";

import { icons } from "../../../components/icons/data";
import { startupIcons } from "../../../components/icons/startup";
import { FaObject } from "../../types/font-awesome";
import { cn } from "../../utils/cn";

type IconGlyph = { viewBox: string; path: string };
type IconCatalog = Record<string, Record<string, IconGlyph>>;

const initialCatalog = createIsomorphicFn()
  .server((): IconCatalog => icons)
  .client((): IconCatalog => startupIcons);

function lookupGlyph(
  catalog: IconCatalog | undefined,
  variant: string,
  icon: string,
): IconGlyph | undefined {
  const selected = catalog?.[variant];
  if (selected === undefined) return undefined;
  // Banners retain legacy class strings, including the icon name and utilities.
  const name = icon.split(/\s+/).find((part) => Object.hasOwn(selected, part));
  return name === undefined ? undefined : selected[name];
}

export type FaProps = {
  fixedWidth?: boolean;
  spin?: boolean;
  size?: number;
  class?: string;
} & FaObject;

export function Fa(props: FaProps): JSXElement {
  const variant = (): string => props.variant ?? "solid";
  const [extended, setExtended] = createSignal<IconCatalog>();
  const glyph = (): IconGlyph | undefined =>
    lookupGlyph(initialCatalog(), variant(), props.icon) ??
    lookupGlyph(extended(), variant(), props.icon);

  if (!isServer) {
    createEffect(() => {
      if (glyph() !== undefined || extended() !== undefined) return;
      let disposed = false;
      onCleanup(() => {
        disposed = true;
      });
      void import("../../../components/icons/data")
        .then((module) => {
          if (!disposed) setExtended(module.icons);
        })
        .catch(() => undefined);
    });
  }
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

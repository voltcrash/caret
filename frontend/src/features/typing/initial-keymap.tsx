import { For, Show, createMemo } from "solid-js";

import type { InitialTypingSnapshot } from "./initial-snapshot";

import { cn } from "../../ts/utils/cn";
import { convertLayoutToKeymap } from "./keymapConverter";

/** Static counterpart of Keymap; uses the same geometry and saved layout. */
export function InitialKeymap(props: { snapshot: InitialTypingSnapshot }) {
  const config = () => props.snapshot.settings;
  const definition = createMemo(() => {
    const layout = props.snapshot.keymapLayout;
    if (config().keymapMode === "off" || layout === undefined) return [];
    const rows = convertLayoutToKeymap(layout, {
      keymapStyle: config().keymapStyle,
      showAllKeys:
        config().keymapKeys === "full" || layout.matrixShowRightColumn === true,
    });
    const firstRow =
      config().keymapKeys === "full" ||
      config().keymapKeys === "minimal_numrow" ||
      (config().keymapKeys === "minimal" && layout.keymapShowTopRow) ||
      (config().keymapMode === "next" &&
        props.snapshot.words.some((word) => /\d/.test(word)));
    return firstRow ? rows : rows.slice(1);
  });
  const displayName = () =>
    (config().keymapLayout === "overrideSync"
      ? config().layout
      : config().keymapLayout
    ).replaceAll("_", " ");
  return (
    <Show when={definition().length > 0}>
      <div
        data-initial-keymap
        class="flex w-full flex-col items-center py-8 text-sm text-sub max-sm:pointer-coarse:hidden"
      >
        <div
          class="w-fit zoom-(--kb-zoom-xxs) xs:zoom-(--kb-zoom-xs) sm:zoom-(--kb-zoom-sm) md:zoom-(--kb-zoom-md) lg:zoom-(--kb-zoom-lg) xl:zoom-(--kb-zoom-xl) 2xl:zoom-(--kb-zoom-2xl)"
          style={{
            "--kb-zoom-xxs": Math.min(config().keymapSize, 0.5),
            "--kb-zoom-xs": Math.min(config().keymapSize, 0.7),
            "--kb-zoom-sm": Math.min(config().keymapSize, 1),
            "--kb-zoom-md": Math.min(config().keymapSize, 1.3),
            "--kb-zoom-lg": Math.min(config().keymapSize, 1.7),
            "--kb-zoom-xl": Math.min(config().keymapSize, 2.2),
            "--kb-zoom-2xl": Math.min(config().keymapSize, 2.9),
          }}
        >
          <For each={definition()}>
            {(row) => (
              <div class="flex h-8 flex-row">
                <For each={row}>
                  {(key) => {
                    const label = () => {
                      if (config().keymapLegendStyle === "blank") return "";
                      if (config().keymapLegendStyle !== "uppercase") {
                        return key.legends[0] ?? "";
                      }
                      return /^[^\p{L}\p{N}]$/u.test(key.legends[0] ?? "")
                        ? (key.legends[0] ?? "")
                        : (key.legends[1] ?? "");
                    };
                    return (
                      <div
                        class={cn(
                          "relative flex justify-center rounded border-2 border-bg bg-sub-alt",
                          label().length >= 2 && "text-em-xs",
                          key.align === "top"
                            ? "items-start pt-1.5"
                            : "items-center",
                        )}
                        style={{
                          height: `${(key.height ?? 1) * 2}rem`,
                          width: `${(key.width ?? 1) * 2}rem`,
                          "margin-left": `${(key.x ?? 0) * 2}rem`,
                          "margin-top": `${(key.y ?? 0) * 2}rem`,
                          transform:
                            key.rotation === undefined
                              ? ""
                              : `rotate(${key.rotation}deg)`,
                        }}
                      >
                        <Show
                          when={key.isLayoutIndicator}
                          fallback={
                            <>
                              {label()}
                              <Show when={key.isHoming}>
                                <div class="bg-em-xs absolute bottom-0.75 left-auto h-0.5 w-2 rounded bg-bg"></div>
                              </Show>
                            </>
                          }
                        >
                          <span class="text-[0.5em]">{displayName()}</span>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

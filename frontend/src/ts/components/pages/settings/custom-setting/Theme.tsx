import { CustomTheme, CustomThemeNameSchema } from "@oxytype/schemas/users";
import { debounce } from "@oxytype/util/timing";
import { For, JSXElement, onCleanup, Show, untrack } from "solid-js";
import { z } from "zod";

import {
  addCustomTheme,
  deleteCustomTheme,
  editCustomTheme,
  useCustomThemesLiveQuery,
} from "../../../../collections/custom-themes";
import { configMetadata } from "../../../../config/metadata";
import { setConfig } from "../../../../config/setters";
import { getConfig } from "../../../../config/store";
import {
  ColorName,
  ThemesList,
  ThemeWithName,
} from "../../../../constants/themes";
import {
  clearPreview,
  convertCustomColorsToTheme,
  convertThemeToCustomColors,
  preview,
} from "../../../../controllers/theme-controller";
import { createEffectOn } from "../../../../hooks/effects";
import { isAuthenticated } from "../../../../states/core";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "../../../../states/notifications";
import { showSimpleModal } from "../../../../states/simple-modal";
import { getTheme, setTheme, updateThemeColor } from "../../../../states/theme";
import { cn } from "../../../../utils/cn";
import { hexToHSL } from "../../../../utils/colors";
import {
  normalizeName,
  replaceUnderscoresWithSpaces,
} from "../../../../utils/strings";
import { AnimeSwitch } from "../../../common/anime";
import { AnimeMatch } from "../../../common/anime/AnimeMatch";
import { Button } from "../../../common/Button";
import { Fa } from "../../../common/Fa";
import { Separator } from "../../../common/Separator";
import { SearchableSetting } from "../SearchableSetting";

// darkest background first
const sortedThemes: ThemeWithName[] = [...ThemesList].sort((a, b) => {
  const b1 = hexToHSL(a.bg);
  const b2 = hexToHSL(b.bg);
  return b1.lgt - b2.lgt;
});

export function Theme(): JSXElement {
  const customThemes = useCustomThemesLiveQuery();

  const resetTheme = async (): Promise<void> => {
    await clearPreview(false);
    // Resetting inactive custom colors also applies them. Reapply the preset
    // through the normal setter even when its name was already the default.
    setConfig("theme", getConfig.theme);
  };

  // hovering a preset previews it; leaving the presets (or the page) restores
  // the current theme. cleared on the whole list rather than per button so
  // moving between buttons doesn't flash the current theme in between
  onCleanup(() => void clearPreview());

  const Presets = () => (
    <div class="grid gap-4" onMouseLeave={() => void clearPreview()}>
      <Show when={getConfig.favThemes.length > 0}>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <For
            each={sortedThemes.filter((t) =>
              getConfig.favThemes.includes(t.name),
            )}
          >
            {(theme) => <ThemeButton theme={theme} />}
          </For>
        </div>
      </Show>
      <Show when={getConfig.favThemes.length > 0}>
        <Separator />
      </Show>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <For
          each={sortedThemes.filter(
            (t) => !getConfig.favThemes.includes(t.name),
          )}
        >
          {(theme) => <ThemeButton theme={theme} />}
        </For>
      </div>
    </div>
  );

  const Customs = () => (
    <div class="grid gap-4">
      <Show when={isAuthenticated()}>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <For each={customThemes()}>
            {(theme) => <CustomThemeButton theme={theme} />}
          </For>
        </div>
      </Show>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Picker color="bg" />
        <Picker color="main" />
        <Picker color="sub" />
        <Picker color="text" />
        <Picker color="caret" />
        <Picker color="subAlt" />
        <Picker color="error" />
        <Picker color="errorExtra" />
        <div class="col-span-1 text-sub md:col-span-2">
          when colorful mode is enabled:
        </div>
        <Picker color="colorfulError" />
        <Picker color="colorfulErrorExtra" />
      </div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          text="load from preset"
          onClick={() => {
            const presetTheme = ThemesList.find(
              (t) => t.name === getConfig.theme,
            );
            if (presetTheme) {
              setTheme({ ...presetTheme, name: "custom" });
            } else {
              showErrorNotification(
                "Current preset theme not found. How is this possible?",
              );
            }
          }}
        />
        <Button
          text="share"
          onClick={() => {
            showSimpleModal({
              title: "Share custom theme",
              schema: z.object({ includeBackground: z.boolean().optional() }),
              inputs: {
                includeBackground: {
                  label: "Include background link, size and filters",
                  type: "checkbox",
                },
              },
              buttonText: "copy link to clipboard",
              buttonAlwaysEnabled: true,
              execFn: async ({ includeBackground }) => {
                const newTheme: {
                  c: string[]; //colors
                  i?: string; //image
                  s?: string; //size
                  f?: object; //filter
                } = {
                  c: convertThemeToCustomColors(getTheme()),
                };

                if (includeBackground) {
                  newTheme.i = getConfig.customBackground;
                  newTheme.s = getConfig.customBackgroundSize;
                  newTheme.f = getConfig.customBackgroundFilter;
                }

                const link = `${window.location.origin}?customTheme=${btoa(
                  JSON.stringify(newTheme),
                )}`;

                try {
                  await navigator.clipboard.writeText(link);
                  showSuccessNotification("URL Copied to clipboard");
                } catch (e) {
                  showNoticeNotification(
                    "Looks like we couldn't copy the link straight to your clipboard. Please copy it manually.",
                    {
                      durationMs: 5000,
                    },
                  );

                  setTimeout(() => {
                    showSimpleModal({
                      title: "Custom theme URL",
                      class: "max-w-2xl",
                      schema: z.object({ url: z.string() }),
                      inputs: {
                        url: {
                          type: "textarea",
                          placeholder: "URL",
                          initVal: link,
                          clickToSelect: true,
                          readOnly: true,
                          class: "h-50",
                        },
                      },
                      execFn: async () => {
                        return {
                          status: "success",
                          showNotification: false,
                        };
                      },
                    });
                  }, 250);
                  // this is flaky, no chaining for simple modals
                }

                return {
                  status: "success",
                  showNotification: false,
                };
              },
            });
          }}
        />
        <Show when={isAuthenticated()}>
          <Button
            text="save as new"
            onClick={() => {
              if (customThemes().length >= 20) {
                showNoticeNotification("Custom themes limit reached");
                return;
              }

              void addCustomTheme({
                name: "custom",
                colors: convertThemeToCustomColors(getTheme()),
              })
                .then(() => {
                  showSuccessNotification("Custom theme saved");
                })
                .catch((e: unknown) => {
                  showErrorNotification(
                    e instanceof Error
                      ? e.message
                      : "Failed to save custom theme",
                  );
                });
            }}
          />
        </Show>
        <Show when={!isAuthenticated()}>
          <Button
            text="save"
            onClick={() => {
              setConfig(
                "customThemeColors",
                convertThemeToCustomColors(getTheme()),
              );
              showSuccessNotification("Custom theme colors saved");
            }}
          />
        </Show>
      </div>
    </div>
  );

  createEffectOn(
    () => getConfig.customTheme,
    (custom) => {
      if (custom) {
        const colorsObj = convertCustomColorsToTheme(
          getConfig.customThemeColors,
        );
        setTheme({ ...colorsObj, name: "custom" });
      }
    },
  );

  return (
    <SearchableSetting
      key="theme"
      resetKeys={["customThemeColors", "customTheme", "theme"]}
      onReset={resetTheme}
      title={configMetadata.theme.displayString ?? "theme"}
      fa={configMetadata.theme.fa}
      description={configMetadata.theme.description}
      inputs={
        <div class="grid w-full grid-cols-2 gap-2">
          <Button
            onClick={() => setConfig("customTheme", false)}
            active={!getConfig.customTheme}
            text="preset"
          />
          <Button
            onClick={() => setConfig("customTheme", true)}
            active={getConfig.customTheme}
            text="custom"
          />
        </div>
      }
      fullWidthInputs={
        // <AnimeConditional
        //   exitBeforeEnter
        //   if={!getConfig.customTheme}
        //   then={<Presets />}
        //   else={<Customs />}
        // />
        // <AnimePresence exitBeforeEnter>

        //   </AnimePresence>
        <AnimeSwitch
          exitBeforeEnter
          animeProps={{
            initial: {
              opacity: 0,
              duration: 125,
            },
            animate: {
              opacity: 1,
              duration: 125,
            },
            exit: {
              opacity: 0,
              duration: 125,
            },
          }}
        >
          <AnimeMatch when={!getConfig.customTheme}>
            <Presets />
          </AnimeMatch>
          <AnimeMatch when={getConfig.customTheme}>
            <Customs />
          </AnimeMatch>
        </AnimeSwitch>
      }
    />
  );
}

function CustomThemeButton(props: { theme: CustomTheme }): JSXElement {
  const themeColors = () => convertCustomColorsToTheme(props.theme.colors);

  return (
    <div
      style={{
        "--bg": themeColors().bg,
        "--main": themeColors().main,
        "--sub": themeColors().sub,
        "--text": themeColors().text,
      }}
      class={cn(
        "group/theme grid grid-cols-[auto_1fr_auto] justify-between p-0 ring-4 ring-transparent",
        "pointer-coarse:min-h-11",
        "bg-(--bg) text-(--main)",
        "hover:ring-(--main)",
        "transition-[opacity,color,background,box-shadow] duration-125",
      )}
      data-theme-id={props.theme._id}
    >
      <Button
        aria-label={`Edit theme ${props.theme.name}`}
        variant="text"
        fa={{
          icon: "fa-pen",
          fixedWidth: true,
        }}
        class={cn(
          "mx-1 p-2",
          "[--themable-button-hover-text:var(--main)] [--themable-button-text:var(--sub)]",
          "opacity-0 group-hover/theme:opacity-100 group-focus-within/theme:opacity-100 pointer-coarse:opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          showSimpleModal({
            title: "Update custom theme",
            schema: z.object({
              name: CustomThemeNameSchema,
              updateColors: z.boolean(),
            }),
            inputs: {
              name: {
                type: "text",
                initVal: replaceUnderscoresWithSpaces(props.theme.name),
                preprocess: normalizeName,
              },
              updateColors: {
                type: "checkbox",
                label: "Update custom theme to current colors",
              },
            },
            buttonText: "update",
            execFn: async ({ name, updateColors }) => {
              if (name === undefined) {
                return {
                  status: "error",
                  message: "Name is required",
                };
              }
              editCustomTheme({
                themeId: props.theme._id,
                name,
                colors: updateColors
                  ? convertThemeToCustomColors(untrack(() => getTheme()))
                  : untrack(() => props.theme.colors),
              })
                .then(() => {
                  showSuccessNotification("Updated");
                })
                .catch(() => {
                  showErrorNotification(
                    e instanceof Error
                      ? e.message
                      : "Failed to update custom theme",
                  );
                });

              return {
                status: "success",
                showNotification: false,
              };
            },
          });
        }}
      />
      <Button
        variant="text"
        aria-label={`Apply theme ${props.theme.name}`}
        class="min-w-0 p-2 [--themable-button-text:var(--main)] [--themable-button-hover-text:var(--text)]"
        onClick={() => setConfig("customThemeColors", props.theme.colors)}
      >
        <span class="min-w-0 truncate">
          {replaceUnderscoresWithSpaces(props.theme.name)}
        </span>
      </Button>
      <Button
        aria-label={`Delete theme ${props.theme.name}`}
        variant="text"
        fa={{
          icon: "fa-trash",
          fixedWidth: true,
        }}
        class={cn(
          "mx-1 p-2",
          "[--themable-button-hover-text:var(--main)] [--themable-button-text:var(--sub)]",
          "opacity-0 group-hover/theme:opacity-100 group-focus-within/theme:opacity-100 pointer-coarse:opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          showSimpleModal({
            title: "Delete custom theme",
            text: `Are you sure you want to delete the custom theme "${replaceUnderscoresWithSpaces(props.theme.name)}"? This action cannot be undone.`,
            buttonText: "delete",
            execFn: async () => {
              void deleteCustomTheme({
                themeId: props.theme._id,
              });
              return {
                status: "success",
                message: "Custom theme deleted",
              };
            },
          });
        }}
      />
    </div>
  );
}

function ThemeButton(props: { theme: ThemeWithName }): JSXElement {
  const isActive = () => getConfig.theme === props.theme.name;
  const isFav = () => getConfig.favThemes.includes(props.theme.name);

  const select = (): void => {
    if (isActive()) return;
    setConfig("theme", props.theme.name);
  };

  const toggleFavorite = (): void => {
    if (isFav()) {
      setConfig(
        "favThemes",
        getConfig.favThemes.filter((t) => t !== props.theme.name),
      );
    } else {
      setConfig("favThemes", [...getConfig.favThemes, props.theme.name]);
    }
  };

  // not a <button>: many theme css files style button:hover (colors,
  // animations, gradients) outside of the tailwind layers. while previewing
  // one of those themes it would restyle these cards, so avoid matching it
  return (
    <div
      style={{
        "--bg": props.theme.bg,
        "--main": props.theme.main,
        "--sub": props.theme.sub,
        "--text": props.theme.text,
      }}
      class={cn(
        "group/theme relative grid cursor-pointer place-items-center overflow-hidden rounded px-1 py-2 leading-[1.25] ring-4 ring-transparent select-none",
        "pointer-coarse:min-h-11",
        "focus-visible:shadow-control-focus focus-visible:outline-none",
        "bg-(--bg) text-(--main)",
        // "hover:bg-(--text) hover:text-(--bg)",
        "hover:ring-(--main)",
        "transition-[opacity,color,background,box-shadow] duration-125",
        isActive() && "ring-4 ring-(--main)",
      )}
      onMouseEnter={() => {
        if (isActive()) {
          void clearPreview();
        } else {
          preview(props.theme.name);
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) select();
      }}
    >
      {/* the name spans the whole button on one line; the star and colors
          overlay its ends and fade it out instead of squeezing it */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Apply theme ${replaceUnderscoresWithSpaces(props.theme.name)}`}
        aria-pressed={isActive()}
        class="w-full px-2 text-center whitespace-nowrap focus-visible:shadow-control-focus"
        onClick={select}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          select();
        }}
      >
        {replaceUnderscoresWithSpaces(props.theme.name)}
      </div>
      <div
        class={cn(
          "absolute inset-y-0 left-0 flex items-center pr-6 pl-1",
          "bg-linear-to-r from-(--bg) from-60% to-transparent",
          "opacity-0 transition-[opacity,color,background] duration-125 group-hover/theme:opacity-100 group-focus-within/theme:opacity-100 pointer-coarse:opacity-100",
          isFav() && "opacity-100",
        )}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={`Favorite theme ${replaceUnderscoresWithSpaces(props.theme.name)}`}
          aria-pressed={isFav()}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite();
          }}
          class={cn(
            "grid justify-center",
            "rounded-full p-1",
            "transition-[opacity,color,background] duration-125",
            "hover:text-(--text)",
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite();
          }}
        >
          <Fa
            icon="fa-star"
            variant={isFav() ? "solid" : "regular"}
            fixedWidth
            class="transition-[opacity,color,background] duration-125"
          />
        </div>
      </div>
      <div
        class={cn(
          "pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5 pl-8",
          "bg-linear-to-l from-(--bg) from-70% to-transparent",
          "opacity-0 transition-opacity duration-125 group-hover/theme:opacity-100 group-focus-within/theme:opacity-100 pointer-coarse:opacity-100",
          isActive() && "opacity-100",
        )}
      >
        <div class="grid shrink-0 grid-cols-3 gap-2">
          <div class="h-4 w-4 rounded-full bg-(--main)"></div>
          <div class="h-4 w-4 rounded-full bg-(--sub)"></div>
          <div class="h-4 w-4 rounded-full bg-(--text)"></div>
        </div>
      </div>
    </div>
  );
}

function Picker(props: { color: ColorName }): JSXElement {
  let colorInputRef: HTMLInputElement | undefined = undefined;

  const text = () => {
    if (props.color === "bg") return "background";
    if (props.color === "main") return "main";
    if (props.color === "sub") return "sub";
    if (props.color === "subAlt") return "sub alt";
    if (props.color === "caret") return "caret";
    if (props.color === "text") return "text";
    if (props.color === "error") return "error";
    if (props.color === "errorExtra") return "extra error";
    if (props.color === "colorfulError") return "error";
    if (props.color === "colorfulErrorExtra") return "extra error";
    return "unknown";
  };

  const _classes = [
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
  const debouncedInput = debounce(125, (e: InputEvent) => {
    const target = e.target as HTMLInputElement;
    const color = target.value;
    const key = untrack(() => props.color);

    updateThemeColor(key, color);
  });

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
          // onChange={(e) => {
          //   const current = [...getConfig.customThemeColors];
          //   current[colorIndex()] = e.currentTarget.value;
          //   setConfig(
          //     "customThemeColors",
          //     current as typeof getConfig.customThemeColors,
          //   );
          // }}
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

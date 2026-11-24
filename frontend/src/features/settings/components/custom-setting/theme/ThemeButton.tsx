import { JSXElement } from "solid-js";

import { Fa } from "#shared/components/common/Fa.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import { ThemeWithName } from "#shared/constants/themes.ts";
import { clearPreview, preview } from "#shared/controllers/theme-controller.ts";
import { cn } from "#shared/utils/cn.ts";
import { replaceUnderscoresWithSpaces } from "#shared/utils/strings.ts";

export function ThemeButton(props: { theme: ThemeWithName }): JSXElement {
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

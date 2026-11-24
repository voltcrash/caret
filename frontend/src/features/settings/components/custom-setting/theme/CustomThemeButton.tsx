import { CustomTheme } from "@caret/schemas/users";
import { JSXElement } from "solid-js";

import { Button } from "#shared/components/common/Button.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { convertCustomColorsToTheme } from "#shared/controllers/theme-controller.ts";
import { cn } from "#shared/utils/cn.ts";
import { replaceUnderscoresWithSpaces } from "#shared/utils/strings.ts";

import {
  openDeleteCustomThemeModal,
  openEditCustomThemeModal,
} from "./theme-modals";

export function CustomThemeButton(props: { theme: CustomTheme }): JSXElement {
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
          openEditCustomThemeModal(props.theme);
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
          openDeleteCustomThemeModal(props.theme);
        }}
      />
    </div>
  );
}

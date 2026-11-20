import palettes from "./theme-palettes.json" with { type: "json" };
import { CustomThemeColors, ThemeName } from "@caret/schemas/configs";
import { z } from "zod";

const hexColorSchema = z
  .string()
  .regex(
    /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    "Invalid hex color",
  );

export const ThemeSchema = z.object({
  hasCss: z.boolean().optional(),
  bg: hexColorSchema,
  main: hexColorSchema,
  caret: hexColorSchema,
  sub: hexColorSchema,
  subAlt: hexColorSchema,
  text: hexColorSchema,
  error: hexColorSchema,
  errorExtra: hexColorSchema,
  colorfulError: hexColorSchema,
  colorfulErrorExtra: hexColorSchema,
});
export type Theme = z.infer<typeof ThemeSchema>;
export type ColorName = keyof Omit<Theme, "hasCss">;
export const themes: Record<ThemeName, Theme> = palettes;

export type ThemeWithName = Theme & { name: ThemeName };
export const ThemesList: ThemeWithName[] = Object.keys(themes)
  .sort()
  .map((it) => ({
    ...themes[it as ThemeName],
    name: it as ThemeName,
  }));

export function convertCustomColorsToTheme(colors: CustomThemeColors): Theme {
  return {
    bg: colors[0],
    main: colors[1],
    caret: colors[2],
    sub: colors[3],
    subAlt: colors[4],
    text: colors[5],
    error: colors[6],
    errorExtra: colors[7],
    colorfulError: colors[8],
    colorfulErrorExtra: colors[9],
  };
}

export function convertThemeToCustomColors(theme: Theme): CustomThemeColors {
  return [
    theme.bg,
    theme.main,
    theme.caret,
    theme.sub,
    theme.subAlt,
    theme.text,
    theme.error,
    theme.errorExtra,
    theme.colorfulError,
    theme.colorfulErrorExtra,
  ];
}

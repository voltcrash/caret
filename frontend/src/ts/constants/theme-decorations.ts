// All 52 decorations total ~48 KB before compression. Keep them in one lazy
// chunk so default-theme startup pays 0 bytes while pickers preload it for
// instant hover previews without stylesheet requests.
const themeStyles = import.meta.glob<string>("../../../static/themes/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
});

export function getThemeDecoration(name: string): string {
  return themeStyles[`../../../static/themes/${name}.css`] ?? "";
}

/**
 * Oxytype mark: a sharp-cornered "O" ("oxy", Greek for sharp) whose counter
 * is a text caret. One path on a 48-unit grid; the counter winds against the
 * outer edge, so the default nonzero fill leaves it open.
 */
export const oxytypeMarkPath =
  "M24 5H41a2 2 0 0 1 2 2V24A19 19 0 1 1 24 5ZM24 13a4 4 0 0 0-4 4v14a4 4 0 0 0 8 0V17a4 4 0 0 0-4-4Z";

export const oxytypeMarkViewBox = "0 0 48 48";

/** Default (serika dark) brand colors for static icons. */
export const oxytypeBrandColors = { bg: "#323437", main: "#e2b714" } as const;

/**
 * App icon: the mark on a rounded tile. `maskable` drops the corner radius
 * and shrinks the mark into the safe zone, for launchers that crop.
 */
export function oxytypeIconSvg(
  colors: { bg: string; main: string } = oxytypeBrandColors,
  options: { maskable?: boolean } = {},
): string {
  const scale = options.maskable === true ? 0.62 : 0.8;
  const offset = 24 * (1 - scale);
  const radius = options.maskable === true ? 0 : 11;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${oxytypeMarkViewBox}">` +
    `<rect width="48" height="48" rx="${radius}" fill="${colors.bg}"/>` +
    `<path transform="translate(${offset.toFixed(2)} ${offset.toFixed(2)}) scale(${scale})" fill="${colors.main}" d="${oxytypeMarkPath}"/>` +
    `</svg>`
  );
}

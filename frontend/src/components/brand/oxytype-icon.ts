/**
 * Oxytype mark: an I-beam text cursor with curled serifs. Every stroke is
 * outlined in the same winding, so the default nonzero fill unions them into
 * one shape on a 48-unit grid.
 */
export const oxytypeMarkPath =
  "M16.5 4.5A10 10 0 0 1 26.5 14.5A2.5 2.5 0 0 1 21.5 14.5A5 5 0 0 0 16.5 9.5A2.5 2.5 0 0 1 16.5 4.5ZM21.5 14.5A10 10 0 0 1 31.5 4.5A2.5 2.5 0 0 1 31.5 9.5A5 5 0 0 0 26.5 14.5A2.5 2.5 0 0 1 21.5 14.5ZM21.5 14.5A2.5 2.5 0 0 1 26.5 14.5L26.5 33.5A2.5 2.5 0 0 1 21.5 33.5L21.5 14.5ZM26.5 33.5A10 10 0 0 1 16.5 43.5A2.5 2.5 0 0 1 16.5 38.5A5 5 0 0 0 21.5 33.5A2.5 2.5 0 0 1 26.5 33.5ZM31.5 43.5A10 10 0 0 1 21.5 33.5A2.5 2.5 0 0 1 26.5 33.5A5 5 0 0 0 31.5 38.5A2.5 2.5 0 0 1 31.5 43.5Z";

export const oxytypeMarkViewBox = "0 0 48 48";

/** Default (serika dark) brand colors for static icons. */
export const oxytypeBrandColors = { bg: "#323437", main: "#e2b714" } as const;

/**
 * App icon: the mark on a tile. Defaults suit favicons; launcher icons that
 * get cropped pass `radius: 0` and a smaller `scale` to stay in the safe zone.
 */
export function oxytypeIconSvg(
  colors: { bg: string; main: string } = oxytypeBrandColors,
  options: { radius?: number; scale?: number } = {},
): string {
  const { radius = 11, scale = 0.8 } = options;
  const offset = +(24 * (1 - scale)).toFixed(2);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${oxytypeMarkViewBox}">` +
    `<rect width="48" height="48" rx="${radius}" fill="${colors.bg}"/>` +
    `<path transform="translate(${offset} ${offset}) scale(${scale})" fill="${colors.main}" d="${oxytypeMarkPath}"/>` +
    `</svg>`
  );
}

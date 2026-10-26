/**
 * Caret mark: an I-beam text cursor with curled serifs. Every stroke is
 * outlined in the same winding, so the default nonzero fill unions them into
 * one shape on a 48-unit grid.
 */
export const caretMarkPath =
  "M16.5 4A10.5 10.5 0 0 1 27 14.5A3 3 0 0 1 21 14.5A4.5 4.5 0 0 0 16.5 10A3 3 0 0 1 16.5 4ZM21 14.5A10.5 10.5 0 0 1 31.5 4A3 3 0 0 1 31.5 10A4.5 4.5 0 0 0 27 14.5A3 3 0 0 1 21 14.5ZM21 14.5A3 3 0 0 1 27 14.5L27 33.5A3 3 0 0 1 21 33.5L21 14.5ZM27 33.5A10.5 10.5 0 0 1 16.5 44A3 3 0 0 1 16.5 38A4.5 4.5 0 0 0 21 33.5A3 3 0 0 1 27 33.5ZM31.5 44A10.5 10.5 0 0 1 21 33.5A3 3 0 0 1 27 33.5A4.5 4.5 0 0 0 31.5 38A3 3 0 0 1 31.5 44Z";

const caretMarkViewBox = "0 0 48 48";

/** The mark's ink bounds, for inline use without side padding. */
export const caretMarkInkViewBox = "13.5 4 21 40";

/** Default (serika dark) brand colors for static icons. */
export const caretBrandColors = { bg: "#323437", main: "#e2b714" } as const;

/**
 * App icon: the mark on a tile. Defaults suit favicons; launcher icons that
 * get cropped pass `radius: 0` and a smaller `scale` to stay in the safe zone.
 */
export function caretIconSvg(
  colors: { bg: string; main: string } = caretBrandColors,
  options: { radius?: number; scale?: number } = {},
): string {
  const { radius = 11, scale = 0.8 } = options;
  const offset = +(24 * (1 - scale)).toFixed(2);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${caretMarkViewBox}">` +
    `<rect width="48" height="48" rx="${radius}" fill="${colors.bg}"/>` +
    `<path transform="translate(${offset} ${offset}) scale(${scale})" fill="${colors.main}" d="${caretMarkPath}"/>` +
    `</svg>`
  );
}

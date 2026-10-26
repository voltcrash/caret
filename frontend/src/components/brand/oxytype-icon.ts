/**
 * Oxytype mark: an I-beam text cursor with curled serifs and a subscript 2,
 * read like O₂ ("oxy"). Every stroke is outlined in the same winding, so the
 * default nonzero fill unions them into one shape on a 48-unit grid.
 */
export const oxytypeMarkPath =
  "M8.5 4.5A10 10 0 0 1 18.5 14.5A2.5 2.5 0 0 1 13.5 14.5A5 5 0 0 0 8.5 9.5A2.5 2.5 0 0 1 8.5 4.5ZM13.5 14.5A10 10 0 0 1 23.5 4.5A2.5 2.5 0 0 1 23.5 9.5A5 5 0 0 0 18.5 14.5A2.5 2.5 0 0 1 13.5 14.5ZM13.5 14.5A2.5 2.5 0 0 1 18.5 14.5L18.5 33.5A2.5 2.5 0 0 1 13.5 33.5L13.5 14.5ZM18.5 33.5A10 10 0 0 1 8.5 43.5A2.5 2.5 0 0 1 8.5 38.5A5 5 0 0 0 13.5 33.5A2.5 2.5 0 0 1 18.5 33.5ZM23.5 43.5A10 10 0 0 1 13.5 33.5A2.5 2.5 0 0 1 18.5 33.5A5 5 0 0 0 23.5 38.5A2.5 2.5 0 0 1 23.5 43.5ZM27.5 30.5A7 7 0 1 1 39.45 35.45A2 2 0 0 1 36.62 32.62A3 3 0 1 0 31.5 30.5A2 2 0 0 1 27.5 30.5ZM36.67 32.57A2 2 0 0 1 39.4 35.5L31.36 42.97A2 2 0 0 1 28.64 40.03L36.67 32.57ZM30 43.5A2 2 0 0 1 30 39.5L40 39.5A2 2 0 0 1 40 43.5L30 43.5Z";

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

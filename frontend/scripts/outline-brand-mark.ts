/**
 * Prints `oxytypeMarkPath`: the mark's strokes outlined as filled shapes, all
 * wound clockwise so nonzero fill unions them. Edit the strokes below, paste
 * the output into `src/components/brand/oxytype-icon.ts`, then run
 * `vp run generate-brand-icons`.
 * vpx ./scripts/outline-brand-mark.ts
 */

type Point = [number, number];
type Segment =
  | { kind: "L"; to: Point }
  | { kind: "A"; r: number; large: 0 | 1; sweep: 0 | 1; to: Point };

const deg = Math.PI / 180;
const at = (c: Point, r: number, a: number): Point => [
  c[0] + r * Math.cos(a),
  c[1] + r * Math.sin(a),
];
const num = (n: number): string => {
  const s = n.toFixed(2).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};
const pt = (p: Point): string => `${num(p[0])} ${num(p[1])}`;

function signedArea(poly: Point[]): number {
  let sum = 0;
  poly.forEach(([x, y], i) => {
    const [nx, ny] = poly[(i + 1) % poly.length] as Point;
    sum += x * ny - nx * y;
  });
  return sum / 2;
}

/** Emits a closed subpath, reversed if `samples` wind counter-clockwise. */
function outline(start: Point, segments: Segment[], samples: Point[]): string {
  if (signedArea(samples) < 0) {
    const points = [start, ...segments.map((s) => s.to)];
    segments = segments
      .map((s, i): Segment => {
        const to = points[i] as Point;
        return s.kind === "L"
          ? { kind: "L", to }
          : { ...s, sweep: s.sweep === 1 ? 0 : 1, to };
      })
      .reverse();
    start = points[points.length - 1] as Point;
  }
  return `M${pt(start)}${segments
    .map((s) =>
      s.kind === "L"
        ? `L${pt(s.to)}`
        : `A${num(s.r)} ${num(s.r)} 0 ${s.large} ${s.sweep} ${pt(s.to)}`,
    )
    .join("")}Z`;
}

/** Straight stroke with round caps. */
function line(p: Point, q: Point, width: number): string {
  const h = width / 2;
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const [ux, uy] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
  const a: Point = [p[0] - uy * h, p[1] + ux * h];
  const b: Point = [q[0] - uy * h, q[1] + ux * h];
  const c: Point = [q[0] + uy * h, q[1] - ux * h];
  const d: Point = [p[0] + uy * h, p[1] - ux * h];
  const sweep = signedArea([a, b, c, d]) > 0 ? 1 : 0;
  return outline(
    a,
    [
      { kind: "L", to: b },
      { kind: "A", r: h, large: 0, sweep, to: c },
      { kind: "L", to: d },
      { kind: "A", r: h, large: 0, sweep, to: a },
    ],
    [
      a,
      b,
      [q[0] + ux * h, q[1] + uy * h],
      c,
      d,
      [p[0] - ux * h, p[1] - uy * h],
    ],
  );
}

/** Clockwise arc stroke from angle `from` to `to` with round caps. */
function arc(
  c: Point,
  r: number,
  from: number,
  to: number,
  width: number,
): string {
  const h = width / 2;
  const large = to - from > Math.PI ? 1 : 0;
  const mid = (from + to) / 2;
  const end = at(c, r, to);
  const begin = at(c, r, from);
  const o0 = at(c, r + h, from);
  const o1 = at(c, r + h, to);
  const i1 = at(c, r - h, to);
  const i0 = at(c, r - h, from);
  return outline(
    o0,
    [
      { kind: "A", r: r + h, large, sweep: 1, to: o1 },
      { kind: "A", r: h, large: 0, sweep: 1, to: i1 },
      { kind: "A", r: r - h, large, sweep: 0, to: i0 },
      { kind: "A", r: h, large: 0, sweep: 1, to: o0 },
    ],
    [
      o0,
      at(c, r + h, mid),
      o1,
      [end[0] - Math.sin(to) * h, end[1] + Math.cos(to) * h],
      i1,
      at(c, r - h, mid),
      i0,
      [begin[0] + Math.sin(from) * h, begin[1] - Math.cos(from) * h],
    ],
  );
}

// I-beam cursor with curled serifs, centred on the grid.
const beam = 6;
const serif = 7.5;
const stem = 24;
const [left, right] = [stem - serif, stem + serif];
const [top, bottom] = [7, 41];

console.log(
  [
    arc([left, top + serif], serif, -90 * deg, 0, beam),
    arc([right, top + serif], serif, 180 * deg, 270 * deg, beam),
    line([stem, top + serif], [stem, bottom - serif], beam),
    arc([left, bottom - serif], serif, 0, 90 * deg, beam),
    arc([right, bottom - serif], serif, 90 * deg, 180 * deg, beam),
  ].join(""),
);

// Pure chart geometry: scales, tick choice and curve paths. No React, no DOM.

export interface Pt {
  x: number;
  y: number;
}

/** A readable step (1, 2, 5 × 10ⁿ) near `rough`. */
function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const exp = Math.floor(Math.log10(rough));
  const f = rough / 10 ** exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

export interface Axis {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * A y axis with clean round ticks. Bars always start at zero; lines frame the data with a little
 * room so a small change is still visible.
 */
export function niceAxis(values: number[], opts: { fromZero: boolean; tickCount?: number }): Axis {
  const tickCount = opts.tickCount ?? 3;
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (opts.fromZero) lo = Math.min(0, lo);
  if (hi === lo) hi = lo + (hi === 0 ? 1 : Math.abs(hi) * 0.1);
  const step = niceStep((hi - lo) / tickCount);
  let min = Math.floor(lo / step) * step;
  let max = Math.ceil(hi / step) * step;
  if (!opts.fromZero) {
    // Leave breathing room above and below the data.
    if (max - hi < step * 0.25) max += step;
    if (lo - min < step * 0.25 && min !== 0) min -= step;
  }
  if (opts.fromZero) min = Math.min(0, min);
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min, max, ticks };
}

export const linear = (domain: [number, number], range: [number, number]) => (v: number) => {
  const span = domain[1] - domain[0];
  return span === 0 ? (range[0] + range[1]) / 2 : range[0] + ((v - domain[0]) / span) * (range[1] - range[0]);
};

/**
 * A smooth curve through the points that never overshoots them (monotone cubic, Fritsch-Carlson),
 * so a flat stretch stays flat and the line never dips below a value it did not reach.
 */
export function smoothPath(pts: Pt[]): string {
  const n = pts.length;
  if (n === 0) return '';
  const first = pts[0] as Pt;
  if (n === 1) return `M${first.x},${first.y}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i] as Pt;
    const b = pts[i + 1] as Pt;
    dx.push(b.x - a.x);
    slope.push(b.x === a.x ? 0 : (b.y - a.y) / (b.x - a.x));
  }
  const tangent: number[] = [slope[0] as number];
  for (let i = 1; i < n - 1; i++) {
    const s0 = slope[i - 1] as number;
    const s1 = slope[i] as number;
    tangent.push(s0 * s1 <= 0 ? 0 : (s0 + s1) / 2);
  }
  tangent.push(slope[n - 2] as number);
  for (let i = 0; i < n - 1; i++) {
    const s = slope[i] as number;
    if (s === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = (tangent[i] as number) / s;
    const b = (tangent[i + 1] as number) / s;
    const h = Math.hypot(a, b);
    if (h > 3) {
      tangent[i] = ((3 * a) / h) * s;
      tangent[i + 1] = ((3 * b) / h) * s;
    }
  }
  let d = `M${first.x},${first.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p = pts[i] as Pt;
    const q = pts[i + 1] as Pt;
    const w = (dx[i] as number) / 3;
    d += `C${p.x + w},${p.y + w * (tangent[i] as number)} ${q.x - w},${q.y - w * (tangent[i + 1] as number)} ${q.x},${q.y}`;
  }
  return d;
}

/** A column with a rounded top and a square base, so it grows from the baseline. */
export function columnPath(x: number, w: number, top: number, base: number, r = 4): string {
  const h = Math.max(0, base - top);
  const rr = Math.min(r, w / 2, h);
  return `M${x},${base}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + w - rr}Q${x + w},${top} ${x + w},${top + rr}V${base}Z`;
}

/** Index of the point nearest to x. */
export function nearest(xs: number[], x: number): number {
  let best = 0;
  let bestDist = Infinity;
  xs.forEach((v, i) => {
    const d = Math.abs(v - x);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

/** `1,284` → `1.3K` from 1,000 up; otherwise at most one decimal, no trailing zero. */
export function compact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${trim(v / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(v / 1_000)}K`;
  return trim(v);
}

const trim = (v: number) => String(Math.round(v * 10) / 10);

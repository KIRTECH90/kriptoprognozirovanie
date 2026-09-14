export function clip(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const a = xs.slice().sort((p, q) => p - q);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

export function stdev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / xs.length);
}

export function quantile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const w = idx - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

export function lastFinite(xs: number[]): number {
  for (let i = xs.length - 1; i >= 0; i--) {
    const v = xs[i]!;
    if (Number.isFinite(v)) return v;
  }
  return NaN;
}

export function logReturn(now: number, prev: number): number {
  if (!(now > 0) || !(prev > 0)) return 0;
  return Math.log(now / prev);
}

export function roundTo(x: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(x * p) / p;
}

export function sma(xs: number[], n: number): number[] {
  const out = new Array<number>(xs.length).fill(NaN);
  if (n <= 0) return out;
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i]!;
    if (i >= n) sum -= xs[i - n]!;
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function rollingStdev(xs: number[], n: number): number[] {
  const out = new Array<number>(xs.length).fill(NaN);
  if (n <= 0) return out;
  for (let i = n - 1; i < xs.length; i++) {
    out[i] = stdev(xs.slice(i - n + 1, i + 1));
  }
  return out;
}

export function sliceLast(xs: number[], n: number): number[] {
  if (n <= 0) return [];
  return xs.slice(Math.max(0, xs.length - n));
}

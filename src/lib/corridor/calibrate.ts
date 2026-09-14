import {
  CAL_COVERAGE_BAND,
  CAL_MAX_ITERS,
  CAL_NARROW,
  CAL_STEP_HOURS,
  CAL_WIDEN,
  CAL_Z_MAX_24,
  CAL_Z_MIN_24,
  DEFAULT_CALIBRATION,
  TARGET_COV_24,
  TARGET_COV_48,
  Z75,
  Z80,
} from "./config.ts";
import { runEngine } from "./engine.ts";
import { clip, median } from "./math.ts";
import type { Calibration, Candle, NewsItem, Regime, RegimeCal } from "./types.ts";

export function clipQuantileMult(mult: number, zBase: number): number {
  const z = zBase * mult;
  const clipped = clip(z, CAL_Z_MIN_24, CAL_Z_MAX_24);
  return clipped / zBase;
}

export function newsAsOf(news: NewsItem[], t: number): NewsItem[] {
  return news.filter((n) => n.publishedAt <= t);
}

export type HitRow = {
  ts: number;
  price: number;
  regime: string;
  low24: number;
  high24: number;
  center24: number;
  fact24: number | null;
  hit24: boolean | null;
  width24: number;
  low48: number;
  high48: number;
  center48: number;
  fact48: number | null;
  hit48: boolean | null;
  width48: number;
};

export type WalkForwardResult = {
  calibration: Calibration;
  coverage24: number;
  coverage48: number;
  medianWidth24: number;
  medianWidth48: number;
  n24: number;
  n48: number;
  nDays24: number;
  hours: number;
  rows: HitRow[];
};

export function uniqueDays(rows: { ts: number }[]): number {
  const s = new Set(rows.map((r) => new Date(r.ts).toISOString().slice(0, 10)));
  return s.size;
}

export function scaledBand(center: number, low: number, high: number, loM: number, hiM: number) {
  return {
    low: center + (low - center) * loM,
    high: center + (high - center) * hiM,
  };
}

type HorizonSample = {
  price: number;
  center: number;
  low: number;
  high: number;
  fact: number;
  width: number;
};

export function fitHorizon(
  rows: HorizonSample[],
  target: number,
  zBase: number,
  minWidthToNarrow: number,
  maxWidth: number,
): { lo: number; hi: number; coverage: number; n: number; medianWidth: number } {
  const usable = rows.filter((r) => Number.isFinite(r.fact) && r.price > 0);
  const score = (lo: number, hi: number) => {
    const scored = usable.map((r) => {
      const b = scaledBand(r.center, r.low, r.high, lo, hi);
      return {
        hit: r.fact >= b.low && r.fact <= b.high,
        missLow: r.fact < b.low,
        missHigh: r.fact > b.high,
        width: r.price > 0 ? (b.high - b.low) / r.price : r.width,
      };
    });
    const n = scored.length;
    const coverage = n ? scored.filter((x) => x.hit).length / n : 0;
    const medianWidth = median(scored.map((x) => x.width));
    const missLow = scored.filter((x) => x.missLow).length;
    const missHigh = scored.filter((x) => x.missHigh).length;
    return { coverage, n, medianWidth, missLow, missHigh };
  };

  let lo = 1;
  let hi = 1;
  if (usable.length < 20) {
    const s = score(lo, hi);
    return { lo, hi, coverage: s.coverage, n: s.n, medianWidth: s.medianWidth };
  }

  for (let iter = 0; iter < CAL_MAX_ITERS; iter++) {
    const s = score(lo, hi);
    if (s.coverage >= target - CAL_COVERAGE_BAND && s.coverage <= target + CAL_COVERAGE_BAND) break;
    if (s.coverage < target - CAL_COVERAGE_BAND) {
      if (s.medianWidth >= maxWidth) break;
      if (s.missLow >= s.missHigh) lo *= 1 + CAL_WIDEN;
      if (s.missHigh >= s.missLow) hi *= 1 + CAL_WIDEN;
    } else if (s.coverage > target + CAL_COVERAGE_BAND && s.medianWidth > minWidthToNarrow) {
      lo *= 1 - CAL_NARROW;
      hi *= 1 - CAL_NARROW;
    } else {
      break;
    }
    lo = clipQuantileMult(lo, zBase);
    hi = clipQuantileMult(hi, zBase);
  }
  const final = score(lo, hi);
  return { lo, hi, coverage: final.coverage, n: final.n, medianWidth: final.medianWidth };
}

function samples24(rows: HitRow[]): HorizonSample[] {
  return rows
    .filter((r) => r.fact24 != null)
    .map((r) => ({
      price: r.price,
      center: r.center24,
      low: r.low24,
      high: r.high24,
      fact: r.fact24!,
      width: r.width24,
    }));
}

function samples48(rows: HitRow[]): HorizonSample[] {
  return rows
    .filter((r) => r.fact48 != null)
    .map((r) => ({
      price: r.price,
      center: r.center48,
      low: r.low48,
      high: r.high48,
      fact: r.fact48!,
      width: r.width48,
    }));
}

export function calibrationFromRows(rows: HitRow[]): Calibration {
  const f24 = fitHorizon(samples24(rows), TARGET_COV_24, Z75, 0.065, 0.12);
  const f48 = fitHorizon(samples48(rows), TARGET_COV_48, Z80, 0.09, 0.16);
  const byRegime: NonNullable<Calibration["byRegime"]> = {};
  const regimes = [...new Set(rows.map((r) => r.regime))] as Regime[];
  for (const regime of regimes) {
    const slice = rows.filter((r) => r.regime === regime);
    if (slice.filter((r) => r.fact24 != null).length < 20) continue;
    const a = fitHorizon(samples24(slice), TARGET_COV_24, Z75, 0.065, 0.12);
    const b = fitHorizon(samples48(slice), TARGET_COV_48, Z80, 0.09, 0.16);
    byRegime[regime] = {
      q_lo_mult_24: a.lo,
      q_hi_mult_24: a.hi,
      q_lo_mult_48: b.lo,
      q_hi_mult_48: b.hi,
    } satisfies RegimeCal;
  }
  return {
    q_lo_mult_24: f24.lo,
    q_hi_mult_24: f24.hi,
    q_lo_mult_48: f48.lo,
    q_hi_mult_48: f48.hi,
    last_coverage_24: f24.n ? f24.coverage : null,
    last_median_width_24: f24.n ? f24.medianWidth : null,
    last_coverage_48: f48.n ? f48.coverage : null,
    last_median_width_48: f48.n ? f48.medianWidth : null,
    updated_at: new Date().toISOString(),
    byRegime: Object.keys(byRegime).length ? byRegime : undefined,
  };
}

/**
 * Walk-forward on 1h history. News with publishedAt > t are never used
 * at time t (no future leak). Engine runs uncalibrated; multipliers are
 * fitted on stored bands so low and high can move separately, and again
 * per regime when that slice has enough days.
 */
export function walkForwardCalibrate(opts: {
  h1: Candle[];
  h4: Candle[];
  d1: Candle[];
  m15?: Candle[];
  news?: NewsItem[];
  stepHours?: number;
  symbol?: string;
}): WalkForwardResult {
  const step = opts.stepHours ?? CAL_STEP_HOURS;
  const news = opts.news ?? [];
  const symbol = opts.symbol ?? "BTCUSDT";
  const rows: HitRow[] = [];

  const last = opts.h1.length - 1;
  const start = Math.max(220, last - 400 * 24);
  for (let i = start; i <= last - 24; i += step) {
    const t = opts.h1[i]!.openTime;
    const prefix = {
      m15: (opts.m15 ?? []).filter((c) => c.openTime <= t),
      h1: opts.h1.slice(0, i + 1),
      h4: opts.h4.filter((c) => c.openTime <= t),
      d1: opts.d1.filter((c) => c.openTime <= t),
    };
    if (prefix.h1.length < 80 || prefix.h4.length < 40) continue;
    const bundle = runEngine({
      symbol,
      candles: prefix,
      news: newsAsOf(news, t),
      fearGreed: null,
      staleCandles: false,
      staleNews: false,
      prevSigma24: null,
      prevSigma48: null,
      calibration: DEFAULT_CALIBRATION,
      now: t,
      source: "snapshot",
      skipEmpirical: false,
    });
    const p24 = opts.h1[i + 24]?.close ?? null;
    const p48 = opts.h1[i + 48]?.close ?? null;
    const hit24 = p24 != null ? p24 >= bundle.api.horizon_24h.low && p24 <= bundle.api.horizon_24h.high : null;
    const hit48 = p48 != null ? p48 >= bundle.api.horizon_48h.low && p48 <= bundle.api.horizon_48h.high : null;
    rows.push({
      ts: t,
      price: bundle.api.price,
      regime: bundle.api.regime,
      low24: bundle.api.horizon_24h.low,
      high24: bundle.api.horizon_24h.high,
      center24: bundle.api.horizon_24h.center,
      fact24: p24,
      hit24,
      width24: bundle.api.horizon_24h.width_pct,
      low48: bundle.api.horizon_48h.low,
      high48: bundle.api.horizon_48h.high,
      center48: bundle.api.horizon_48h.center,
      fact48: p48,
      hit48,
      width48: bundle.api.horizon_48h.width_pct,
    });
  }

  const hits24 = rows.filter((r) => r.hit24 != null);
  const hits48 = rows.filter((r) => r.hit48 != null);
  const coverage24 = hits24.length ? hits24.filter((r) => r.hit24).length / hits24.length : 0;
  const coverage48 = hits48.length ? hits48.filter((r) => r.hit48).length / hits48.length : 0;
  const medianWidth24 = median(hits24.map((r) => r.width24));
  const medianWidth48 = median(hits48.map((r) => r.width48));
  const calibration = calibrationFromRows(rows);
  calibration.last_coverage_24 = hits24.length ? coverage24 : null;
  calibration.last_coverage_48 = hits48.length ? coverage48 : null;
  calibration.last_median_width_24 = hits24.length ? medianWidth24 : null;
  calibration.last_median_width_48 = hits48.length ? medianWidth48 : null;

  return {
    calibration,
    coverage24,
    coverage48,
    medianWidth24,
    medianWidth48,
    n24: hits24.length,
    n48: hits48.length,
    nDays24: uniqueDays(hits24),
    hours: opts.h1.length,
    rows,
  };
}

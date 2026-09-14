import {
  CAL_COVERAGE_OVER,
  CAL_COVERAGE_UNDER,
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
import type { Calibration, Candle, NewsItem } from "./types.ts";

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
  low24: number;
  high24: number;
  fact24: number | null;
  hit24: boolean | null;
  width24: number;
};

export type WalkForwardResult = {
  calibration: Calibration;
  coverage24: number;
  coverage48: number;
  medianWidth24: number;
  medianWidth48: number;
  n24: number;
  n48: number;
  hours: number;
  rows: HitRow[];
};

/**
 * Walk-forward on 1h history. News with publishedAt > t are never used
 * at time t (no future leak).
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
  const hits24: boolean[] = [];
  const hits48: boolean[] = [];
  const widths24: number[] = [];
  const widths48: number[] = [];
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
      // Same corridor as the screen: empirical on. Skipping it would calibrate a Gaussian band.
      skipEmpirical: false,
    });
    const p24 = opts.h1[i + 24]?.close;
    if (p24 != null) {
      const hit = p24 >= bundle.api.horizon_24h.low && p24 <= bundle.api.horizon_24h.high;
      hits24.push(hit);
      widths24.push(bundle.api.horizon_24h.width_pct);
      rows.push({
        ts: t,
        price: bundle.api.price,
        low24: bundle.api.horizon_24h.low,
        high24: bundle.api.horizon_24h.high,
        fact24: p24,
        hit24: hit,
        width24: bundle.api.horizon_24h.width_pct,
      });
    }
    const p48 = opts.h1[i + 48]?.close;
    if (p48 != null) {
      hits48.push(p48 >= bundle.api.horizon_48h.low && p48 <= bundle.api.horizon_48h.high);
      widths48.push(bundle.api.horizon_48h.width_pct);
    }
  }

  const coverage24 = hits24.length ? hits24.filter(Boolean).length / hits24.length : 0;
  const coverage48 = hits48.length ? hits48.filter(Boolean).length / hits48.length : 0;
  const medianWidth24 = median(widths24);
  const medianWidth48 = median(widths48);

  let m24 = 1;
  let m48 = 1;
  if (hits24.length >= 20) {
    if (coverage24 < TARGET_COV_24 - CAL_COVERAGE_UNDER) m24 *= 1 + CAL_WIDEN;
    else if (coverage24 > TARGET_COV_24 + CAL_COVERAGE_OVER && medianWidth24 > 0.065) {
      m24 *= 1 - CAL_NARROW;
    }
  }
  if (hits48.length >= 20) {
    if (coverage48 < TARGET_COV_48 - CAL_COVERAGE_UNDER) m48 *= 1 + CAL_WIDEN;
    else if (coverage48 > TARGET_COV_48 + CAL_COVERAGE_OVER && medianWidth48 > 0.09) {
      m48 *= 1 - CAL_NARROW;
    }
  }
  m24 = clipQuantileMult(m24, Z75);
  m48 = clipQuantileMult(m48, Z80);

  const calibration: Calibration = {
    q_lo_mult_24: m24,
    q_hi_mult_24: m24,
    q_lo_mult_48: m48,
    q_hi_mult_48: m48,
    last_coverage_24: hits24.length ? coverage24 : null,
    last_median_width_24: widths24.length ? medianWidth24 : null,
    last_coverage_48: hits48.length ? coverage48 : null,
    last_median_width_48: widths48.length ? medianWidth48 : null,
    updated_at: new Date().toISOString(),
  };
  return {
    calibration,
    coverage24,
    coverage48,
    medianWidth24,
    medianWidth48,
    n24: hits24.length,
    n48: hits48.length,
    hours: opts.h1.length,
    rows,
  };
}

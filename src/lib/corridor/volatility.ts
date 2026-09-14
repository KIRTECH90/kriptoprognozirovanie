import {
  SIGMA24_ATR_BARS,
  SIGMA24_ATR_W,
  SIGMA24_CC_W,
  SIGMA24_PK_W,
  SIGMA48_ATR_4H_BARS,
  SIGMA48_ATR_W,
  SIGMA48_CC_W,
  SIGMA48_PK_W,
  SIGMA_CC_HOURS_24,
  SIGMA_CC_HOURS_48,
  SIGMA_CEIL_MULT,
  SIGMA_FLOOR_MULT,
  SIGMA_MEDIAN_DAYS,
  SMOOTH_SIGMA,
  SMOOTH_SIGMA_PREV,
} from "./config.ts";
import {
  atrWilder,
  closesOf,
  highsOf,
  lastClose,
  lastFinite,
  logReturns,
  lowsOf,
  rollingMedian,
  sigmaCc,
  sigmaParkinson,
} from "./indicators.ts";
import { clip } from "./math.ts";
import type { Candle } from "./types.ts";

export function sigmaRaw24(h1: Candle[]): number {
  const close = lastClose(h1);
  const atr = lastFinite(atrWilder(highsOf(h1), lowsOf(h1), closesOf(h1)));
  const atrTerm = close > 0 && Number.isFinite(atr) ? (atr / close) * Math.sqrt(SIGMA24_ATR_BARS) : 0;
  const cc = sigmaCc(logReturns(closesOf(h1)), SIGMA_CC_HOURS_24);
  const pk = sigmaParkinson(h1, SIGMA_CC_HOURS_24);
  return SIGMA24_ATR_W * atrTerm + SIGMA24_CC_W * cc + SIGMA24_PK_W * pk;
}

export function sigmaRaw48(h1: Candle[], h4: Candle[]): number {
  const close = lastClose(h4.length ? h4 : h1);
  const src = h4.length ? h4 : h1;
  const atr = lastFinite(atrWilder(highsOf(src), lowsOf(src), closesOf(src)));
  const atrTerm =
    close > 0 && Number.isFinite(atr) ? (atr / close) * Math.sqrt(SIGMA48_ATR_4H_BARS) : 0;
  const cc = sigmaCc(logReturns(closesOf(h1)), SIGMA_CC_HOURS_48);
  const pk = sigmaParkinson(h1, SIGMA_CC_HOURS_48);
  return SIGMA48_ATR_W * atrTerm + SIGMA48_CC_W * cc + SIGMA48_PK_W * pk;
}

function rollingSigmaCcMedian(h1: Candle[], hours: number, days: number): number {
  const r = logReturns(closesOf(h1));
  const values: number[] = [];
  const maxWindows = days * 24;
  for (let end = r.length - 1; end >= hours && values.length < maxWindows; end--) {
    let s = 0;
    let ok = true;
    for (let k = 0; k < hours; k++) {
      const v = r[end - k]!;
      if (!Number.isFinite(v)) {
        ok = false;
        break;
      }
      s += v * v;
    }
    if (ok) values.push(Math.sqrt(s));
  }
  return rollingMedian(values, values.length);
}

export function smoothAndClipSigma(
  raw: number,
  prev: number | null,
  medianHist: number,
): number {
  const prevUse = prev != null && Number.isFinite(prev) ? prev : raw;
  let s = SMOOTH_SIGMA * raw + SMOOTH_SIGMA_PREV * prevUse;
  if (medianHist > 0) {
    s = clip(s, SIGMA_FLOOR_MULT * medianHist, SIGMA_CEIL_MULT * medianHist);
  }
  return Math.max(s, 1e-6);
}

export function computeSigmas(
  h1: Candle[],
  h4: Candle[],
  prev24: number | null,
  prev48: number | null,
): { sigma24: number; sigma48: number; raw24: number; raw48: number } {
  const raw24 = sigmaRaw24(h1);
  const raw48 = sigmaRaw48(h1, h4);
  const med24 = rollingSigmaCcMedian(h1, SIGMA_CC_HOURS_24, SIGMA_MEDIAN_DAYS);
  const med48 = rollingSigmaCcMedian(h1, SIGMA_CC_HOURS_48, SIGMA_MEDIAN_DAYS);
  return {
    raw24,
    raw48,
    sigma24: smoothAndClipSigma(raw24, prev24, med24),
    sigma48: smoothAndClipSigma(raw48, prev48, med48),
  };
}

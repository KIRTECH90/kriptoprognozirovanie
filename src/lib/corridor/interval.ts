import {
  ASYM_HI_K,
  ASYM_LO_K,
  ASYM_NEWS_HI_K,
  ASYM_NEWS_LO_K,
  ASYM_RSI_CLIP,
  ASYM_RSI_DIV,
  EMPIRICAL_LOOKBACK_DAYS,
  EMPIRICAL_MAD_FACTOR,
  EMPIRICAL_MIN_SAMPLES,
  EMPIRICAL_Q_HI_24,
  EMPIRICAL_Q_HI_48,
  EMPIRICAL_Q_LO_24,
  EMPIRICAL_Q_LO_48,
  EMPIRICAL_SCALE_MAX,
  EMPIRICAL_SCALE_MIN,
  MAX_WIDTH_24_EVENT,
  MAX_WIDTH_24_NORMAL,
  MAX_WIDTH_48_EVENT,
  MAX_WIDTH_48_NORMAL,
  MIN_LOG_SPAN,
  MIN_WIDTH_24,
  MIN_WIDTH_48,
  RSI_CALM_HI,
  RSI_CALM_LO,
  TARGET_COV_24,
  TARGET_COV_48,
  W_EVENT_EXPAND,
  W_HIGHVOL_EXPAND,
  W_LOWVOL_COMPRESS,
  W_MAX,
  W_MIN,
  W_NEWS_SHOCK_K,
  W_STALE_EXPAND,
  W_TF_ALIGN_COMPRESS,
  W_VOL_RATIO_EXPAND,
  W_VOL_RATIO_TRIGGER,
  Z75,
  Z80,
} from "./config.ts";
import { realizedReturn } from "./indicators.ts";
import { clip, median, quantile } from "./math.ts";
import { composeRegime, regimeFromSets } from "./regime.ts";
import type {
  Calibration,
  Candle,
  HorizonBand,
  Regime,
  WidthInputs,
} from "./types.ts";

export function computeWidthMultiplier(input: WidthInputs): number {
  let w = 1;
  const lowvol = input.regime.includes("LOWVOL");
  const highvol = input.regime.includes("HIGHVOL");
  const calmRsi = input.rsi >= RSI_CALM_LO && input.rsi <= RSI_CALM_HI;
  const bbQuiet = input.bbWidth <= input.bbWidthMedian30d || input.bbWidthMedian30d === 0;

  if (
    lowvol &&
    !input.event &&
    input.newsShock < 0.25 &&
    bbQuiet &&
    calmRsi
  ) {
    w *= W_LOWVOL_COMPRESS;
  }
  if (
    !input.event &&
    input.trend1h !== "range" &&
    input.trend1h === input.trend4h &&
    input.trend4h === input.trend1d
  ) {
    w *= W_TF_ALIGN_COMPRESS;
  }
  if (input.event || input.regime === "EVENT") w *= W_EVENT_EXPAND;
  else if (highvol) w *= W_HIGHVOL_EXPAND;
  if (input.newsShock >= 0.55) w *= 1 + W_NEWS_SHOCK_K * input.newsShock;
  if (input.volRatio >= W_VOL_RATIO_TRIGGER) w *= W_VOL_RATIO_EXPAND;
  if (input.stale) w *= W_STALE_EXPAND;
  return clip(w, W_MIN, W_MAX);
}

export function applyAsymmetry(
  qLo: number,
  qHi: number,
  rsi: number,
  newsShift: number,
): { qLo: number; qHi: number } {
  const a = clip((rsi - 50) / ASYM_RSI_DIV, -ASYM_RSI_CLIP, ASYM_RSI_CLIP);
  let lo = qLo * (1 + ASYM_LO_K * a);
  let hi = qHi * (1 - ASYM_HI_K * a);
  if (newsShift < 0) lo *= 1 + ASYM_NEWS_LO_K * Math.min(1, -newsShift);
  if (newsShift > 0) hi *= 1 + ASYM_NEWS_HI_K * Math.min(1, newsShift);
  return { qLo: lo, qHi: hi };
}

export function fallbackQuantiles(
  sigma: number,
  horizon: 24 | 48,
): { qLo: number; qHi: number } {
  const z = horizon === 24 ? Z75 : Z80;
  return { qLo: -z * sigma, qHi: z * sigma };
}

export function empiricalQuantiles(opts: {
  h1: Candle[];
  h4: Candle[];
  d1: Candle[];
  regimeNow: Regime;
  sigmaNow: number;
  horizonHours: 24 | 48;
  nowIndexEnd?: number;
}): { qLo: number; qHi: number; n: number } | null {
  const { h1, h4, d1, regimeNow, sigmaNow, horizonHours } = opts;
  const facts: number[] = [];
  const step = 4;
  const maxLookback = EMPIRICAL_LOOKBACK_DAYS * 24;
  const start = Math.max(200, h1.length - maxLookback);
  const last = h1.length - 1 - horizonHours;
  for (let i = start; i <= last; i += step) {
    const prefixH1 = h1.slice(0, i + 1);
    const t = h1[i]!.openTime;
    const prefixH4 = h4.filter((c) => c.openTime <= t);
    const prefixD1 = d1.filter((c) => c.openTime <= t);
    if (prefixH4.length < 60 || prefixD1.length < 40) continue;
    const snap = regimeFromSets({
      h1: prefixH1,
      h4: prefixH4,
      d1: prefixD1,
      newsShock: 0,
    });
    const histRegime = composeRegime(snap.trend4h, snap.vol, false);
    if (histRegime !== regimeNow && regimeNow !== "EVENT") continue;
    if (regimeNow === "EVENT" && !snap.event) continue;
    const p0 = h1[i]!.close;
    const pH = h1[i + horizonHours]!.close;
    if (p0 > 0 && pH > 0) facts.push(Math.log(pH / p0));
  }
  if (facts.length < EMPIRICAL_MIN_SAMPLES) return null;
  const sorted = facts.slice().sort((a, b) => a - b);
  const pLo = horizonHours === 24 ? EMPIRICAL_Q_LO_24 : EMPIRICAL_Q_LO_48;
  const pHi = horizonHours === 24 ? EMPIRICAL_Q_HI_24 : EMPIRICAL_Q_HI_48;
  let qLo = quantile(sorted, pLo);
  let qHi = quantile(sorted, pHi);
  const abs = facts.map((r) => Math.abs(r) * EMPIRICAL_MAD_FACTOR);
  const sigmaEmp = median(abs);
  const scale = clip(sigmaNow / (sigmaEmp + 1e-12), EMPIRICAL_SCALE_MIN, EMPIRICAL_SCALE_MAX);
  qLo *= scale;
  qHi *= scale;
  return { qLo, qHi, n: facts.length };
}

function enforceSigns(qLo: number, qHi: number): { qLo: number; qHi: number } {
  let lo = qLo;
  let hi = qHi;
  if (lo >= 0) lo = -Math.abs(lo) || -1e-4;
  if (hi <= 0) hi = Math.abs(hi) || 1e-4;
  return { qLo: lo, qHi: hi };
}

export function assembleHorizon(opts: {
  p0: number;
  mu: number;
  w: number;
  qLo: number;
  qHi: number;
  minWidth: number;
  maxWidth: number;
  targetCoverage: number;
}): HorizonBand {
  const { p0, mu, w, minWidth, maxWidth, targetCoverage } = opts;
  const signed = enforceSigns(opts.qLo, opts.qHi);
  let lLog = mu + w * signed.qLo;
  let hLog = mu + w * signed.qHi;
  if (!(lLog < mu)) lLog = mu - 1e-4;
  if (!(hLog > mu)) hLog = mu + 1e-4;
  if (hLog - lLog < MIN_LOG_SPAN) {
    const mid = (hLog + lLog) / 2;
    lLog = mid - MIN_LOG_SPAN / 2;
    hLog = mid + MIN_LOG_SPAN / 2;
  }
  let low = p0 * Math.exp(lLog);
  let high = p0 * Math.exp(hLog);
  const center = p0 * Math.exp(mu);

  const minSpan = minWidth * p0;
  if (high - low < minSpan) {
    const extra = (minSpan - (high - low)) / 2;
    low -= extra;
    high += extra;
  }
  const maxSpan = maxWidth * p0;
  if (high - low > maxSpan) {
    const scale = maxSpan / (high - low);
    low = center + (low - center) * scale;
    high = center + (high - center) * scale;
  }
  return {
    center,
    expected: center,
    low,
    high,
    width_pct: p0 > 0 ? (high - low) / p0 : 0,
    target_coverage: targetCoverage,
  };
}

export function buildCorridors(opts: {
  p0: number;
  mu24: number;
  mu48: number;
  sigma24: number;
  sigma48: number;
  w: number;
  rsi: number;
  newsShift: number;
  regime: Regime;
  calibration: Calibration;
  empirical24: { qLo: number; qHi: number } | null;
  empirical48: { qLo: number; qHi: number } | null;
  capMult?: number;
}): { h24: HorizonBand; h48: HorizonBand } {
  const fb24 = fallbackQuantiles(opts.sigma24, 24);
  const fb48 = fallbackQuantiles(opts.sigma48, 48);
  let q24 = opts.empirical24 ?? fb24;
  let q48 = opts.empirical48 ?? fb48;
  q24 = {
    qLo: q24.qLo * opts.calibration.q_lo_mult_24,
    qHi: q24.qHi * opts.calibration.q_hi_mult_24,
  };
  q48 = {
    qLo: q48.qLo * opts.calibration.q_lo_mult_48,
    qHi: q48.qHi * opts.calibration.q_hi_mult_48,
  };
  q24 = applyAsymmetry(q24.qLo, q24.qHi, opts.rsi, opts.newsShift);
  q48 = applyAsymmetry(q48.qLo, q48.qHi, opts.rsi, opts.newsShift);
  const event = opts.regime === "EVENT";
  const k = opts.capMult && opts.capMult > 0 ? opts.capMult : 1;
  const h24 = assembleHorizon({
    p0: opts.p0,
    mu: opts.mu24,
    w: opts.w,
    qLo: q24.qLo,
    qHi: q24.qHi,
    minWidth: MIN_WIDTH_24,
    maxWidth: (event ? MAX_WIDTH_24_EVENT : MAX_WIDTH_24_NORMAL) * k,
    targetCoverage: TARGET_COV_24,
  });
  const h48 = assembleHorizon({
    p0: opts.p0,
    mu: opts.mu48,
    w: opts.w,
    qLo: q48.qLo,
    qHi: q48.qHi,
    minWidth: MIN_WIDTH_48,
    maxWidth: (event ? MAX_WIDTH_48_EVENT : MAX_WIDTH_48_NORMAL) * k,
    targetCoverage: TARGET_COV_48,
  });
  return { h24, h48 };
}

export { realizedReturn };

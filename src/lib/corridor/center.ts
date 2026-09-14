import {
  FG_MU24,
  FG_MU48,
  FG_SCALE,
  KAPPA_24,
  KAPPA_48,
  MU24_CLIP_SIGMA,
  MU24_NEWS,
  MU24_RET,
  MU24_TA,
  MU48_CLIP_SIGMA,
  MU48_NEWS,
  MU48_RET,
  MU48_TA,
  STA_EMA20,
  STA_MACD_CLIP,
  STA_MACD_SCALE,
  STA_RSI_CLIP,
  STA_RSI_SCALE,
  STA_TREND,
} from "./config.ts";
import {
  atrWilder,
  closesOf,
  ema,
  highsOf,
  lastClose,
  lastFinite,
  lowsOf,
  macd,
  rsiWilder,
} from "./indicators.ts";
import { clip } from "./math.ts";
import type { Candle, FearGreed, TrendDir } from "./types.ts";

export function taScore(opts: {
  trend4h: TrendDir;
  h1: Candle[];
}): { sTa: number; rsi: number; macdHist: number } {
  const { trend4h, h1 } = opts;
  const c = closesOf(h1);
  const close = lastClose(h1);
  const e20 = lastFinite(ema(c, 20));
  const rsi = lastFinite(rsiWilder(c));
  const atr = lastFinite(atrWilder(highsOf(h1), lowsOf(h1), c));
  const hist = lastFinite(macd(c).hist);

  let s = 0;
  if (trend4h === "up") s += STA_TREND;
  else if (trend4h === "down") s -= STA_TREND;
  s += Number.isFinite(e20) && close > e20 ? STA_EMA20 : -STA_EMA20;
  if (Number.isFinite(rsi)) {
    s += clip((50 - rsi) / STA_RSI_SCALE, -STA_RSI_CLIP, STA_RSI_CLIP);
  }
  if (Number.isFinite(hist) && Number.isFinite(atr)) {
    s += clip((hist / (atr + 1e-12)) * STA_MACD_SCALE, -STA_MACD_CLIP, STA_MACD_CLIP);
  }
  return {
    sTa: clip(s, -1, 1),
    rsi: Number.isFinite(rsi) ? rsi : 50,
    macdHist: Number.isFinite(hist) ? hist : 0,
  };
}

export function fgAdj(fg: FearGreed | null): number {
  if (!fg) return 0;
  return (50 - fg.value) / FG_SCALE;
}

export function shrinkMu(raw: number, kappa: number): number {
  return kappa * raw + (1 - kappa) * 0;
}

export function computeCenters(opts: {
  p0: number;
  sTa: number;
  sigma24: number;
  sigma48: number;
  rLast24: number;
  rLast48: number;
  newsShift: number;
  fg: FearGreed | null;
}): {
  muRaw24: number;
  muRaw48: number;
  mu24: number;
  mu48: number;
  m24: number;
  m48: number;
  fgAdj: number;
} {
  const { p0, sTa, sigma24, sigma48, rLast24, rLast48, newsShift, fg } = opts;
  const muRaw24 = MU24_TA * sTa * sigma24 + MU24_RET * rLast24 + MU24_NEWS * newsShift * sigma24;
  const muRaw48 = MU48_TA * sTa * sigma48 + MU48_RET * rLast48 + MU48_NEWS * newsShift * sigma48;
  const adj = fgAdj(fg);
  let mu24 = shrinkMu(muRaw24, KAPPA_24) + FG_MU24 * adj * sigma24;
  let mu48 = shrinkMu(muRaw48, KAPPA_48) + FG_MU48 * adj * sigma48;
  mu24 = clip(mu24, -MU24_CLIP_SIGMA * sigma24, MU24_CLIP_SIGMA * sigma24);
  mu48 = clip(mu48, -MU48_CLIP_SIGMA * sigma48, MU48_CLIP_SIGMA * sigma48);
  return {
    muRaw24,
    muRaw48,
    mu24,
    mu48,
    m24: p0 * Math.exp(mu24),
    m48: p0 * Math.exp(mu48),
    fgAdj: adj,
  };
}

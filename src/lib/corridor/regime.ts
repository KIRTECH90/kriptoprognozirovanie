import {
  ATR_MEDIAN_DAYS,
  ATR_PERIOD,
  EMA_FAST,
  EMA_MID,
  EMA_SLOW,
  EVENT_ATR_MULT,
  EVENT_LOOKBACK_HOURS,
  EVENT_RET_SIGMA_MULT,
  NEWS_EVENT_THRESHOLD,
  TREND_STRONG_SEP,
  VOL_HIGH_MULT,
  VOL_LOW_MULT,
} from "./config.ts";
import {
  atrWilder,
  closesOf,
  ema,
  highsOf,
  lastClose,
  lastFinite,
  lowsOf,
  realizedReturn,
  rollingMedian,
  sigmaCcHours,
} from "./indicators.ts";
import type { Candle, Regime, TrendDir, VolBucket } from "./types.ts";

export function classifyTrend(
  ema20: number,
  ema50: number,
  ema200: number,
  close: number,
): TrendDir {
  if (ema20 > ema50 && ema50 > ema200 && close > ema50) return "up";
  if (ema20 < ema50 && ema50 < ema200 && close < ema50) return "down";
  return "range";
}

export function trendFromCandles(candles: Candle[]): TrendDir {
  const c = closesOf(candles);
  const e20 = lastFinite(ema(c, EMA_FAST));
  const e50 = lastFinite(ema(c, EMA_MID));
  const e200 = lastFinite(ema(c, EMA_SLOW));
  const close = lastClose(candles);
  if (![e20, e50, e200, close].every(Number.isFinite)) return "range";
  return classifyTrend(e20, e50, e200, close);
}

export function emaSep(candles: Candle[]): number {
  const c = closesOf(candles);
  const h = highsOf(candles);
  const l = lowsOf(candles);
  const e20 = lastFinite(ema(c, EMA_FAST));
  const e50 = lastFinite(ema(c, EMA_MID));
  const atr = lastFinite(atrWilder(h, l, c, ATR_PERIOD));
  if (!Number.isFinite(e20) || !Number.isFinite(e50) || !atr) return 0;
  return (e20 - e50) / atr;
}

export function volBucket(atrPctNow: number, atrPctMedian30d: number): VolBucket {
  if (!(atrPctMedian30d > 0)) return "MIDVOL";
  if (atrPctNow >= VOL_HIGH_MULT * atrPctMedian30d) return "HIGHVOL";
  if (atrPctNow <= VOL_LOW_MULT * atrPctMedian30d) return "LOWVOL";
  return "MIDVOL";
}

export function isEvent(opts: {
  newsShock: number;
  atrPctNow: number;
  atrPctMedian30d: number;
  ret3h: number;
  sigmaCc24h: number;
}): boolean {
  if (opts.newsShock >= NEWS_EVENT_THRESHOLD) return true;
  if (opts.atrPctMedian30d > 0 && opts.atrPctNow >= EVENT_ATR_MULT * opts.atrPctMedian30d) {
    return true;
  }
  if (Math.abs(opts.ret3h) >= EVENT_RET_SIGMA_MULT * opts.sigmaCc24h && opts.sigmaCc24h > 0) {
    return true;
  }
  return false;
}

export function composeRegime(trend: TrendDir, vol: VolBucket, event: boolean): Regime {
  if (event) return "EVENT";
  const t =
    trend === "up" ? "TREND_UP" : trend === "down" ? "TREND_DOWN" : "RANGE";
  return `${t}_${vol}` as Regime;
}

export function trendsAligned(a: TrendDir, b: TrendDir, c: TrendDir): boolean {
  return a !== "range" && a === b && b === c;
}

export function regimeFromSets(opts: {
  h1: Candle[];
  h4: Candle[];
  d1: Candle[];
  newsShock: number;
}): {
  regime: Regime;
  event: boolean;
  trend1h: TrendDir;
  trend4h: TrendDir;
  trend1d: TrendDir;
  vol: VolBucket;
  atrPct1h: number;
  atrPct4h: number;
  atrPctMedian30d: number;
  tfAligned: boolean;
  strong: boolean;
} {
  const { h1, h4, d1, newsShock } = opts;
  const trend1h = trendFromCandles(h1);
  const trend4h = trendFromCandles(h4);
  const trend1d = trendFromCandles(d1);

  const c1 = closesOf(h1);
  const atr1 = atrWilder(highsOf(h1), lowsOf(h1), c1, ATR_PERIOD);
  const close = lastClose(h1);
  const atrNow = lastFinite(atr1);
  const atrPct1h = close > 0 && Number.isFinite(atrNow) ? atrNow / close : 0;
  const atrPctSeries = atr1.map((a, i) => (c1[i]! > 0 ? a / c1[i]! : NaN));
  const atrPctMedian30d = rollingMedian(atrPctSeries, ATR_MEDIAN_DAYS * 24);

  const c4 = closesOf(h4);
  const atr4 = lastFinite(atrWilder(highsOf(h4), lowsOf(h4), c4, ATR_PERIOD));
  const close4 = lastClose(h4);
  const atrPct4h = close4 > 0 && Number.isFinite(atr4) ? atr4 / close4 : 0;

  const sigma24 = sigmaCcHours(h1, 24);
  const ret3h = realizedReturn(h1, EVENT_LOOKBACK_HOURS);
  const event = isEvent({
    newsShock,
    atrPctNow: atrPct1h,
    atrPctMedian30d,
    ret3h,
    sigmaCc24h: sigma24,
  });
  const vol = volBucket(atrPct1h, atrPctMedian30d);
  const regime = composeRegime(trend4h, vol, event);
  const sep = emaSep(h4);
  return {
    regime,
    event,
    trend1h,
    trend4h,
    trend1d,
    vol,
    atrPct1h,
    atrPct4h,
    atrPctMedian30d,
    tfAligned: trendsAligned(trend1h, trend4h, trend1d),
    strong: Math.abs(sep) >= TREND_STRONG_SEP,
  };
}

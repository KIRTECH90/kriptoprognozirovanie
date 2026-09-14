import {
  ATR_PERIOD,
  BB_K,
  BB_PERIOD,
  EMA_FAST,
  MACD_FAST,
  MACD_SIGNAL,
  MACD_SLOW,
  RSI_PERIOD,
  SIGMA_CC_HOURS_24,
  SIGMA_CC_HOURS_48,
  VOL_SMA_PERIOD,
} from "./config.ts";
import { lastFinite, logReturn, rollingStdev, sma, stdev } from "./math.ts";
import type { Candle } from "./types.ts";

/** EMA_1 = P_1; α = 2/(n+1); EMA_t = α P_t + (1-α) EMA_{t-1} */
export function ema(xs: number[], n: number): number[] {
  const out = new Array<number>(xs.length).fill(NaN);
  if (xs.length === 0 || n <= 0) return out;
  const alpha = 2 / (n + 1);
  out[0] = xs[0]!;
  for (let i = 1; i < xs.length; i++) {
    out[i] = alpha * xs[i]! + (1 - alpha) * out[i - 1]!;
  }
  return out;
}

/** RSI Wilder: first average of n deltas, then (prev*(n-1)+x)/n. */
export function rsiWilder(closes: number[], n = RSI_PERIOD): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (closes.length < n + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= n;
  avgLoss /= n;
  out[n] = rsiFrom(avgGain, avgLoss);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    const gain = Math.max(d, 0);
    const loss = Math.max(-d, 0);
    avgGain = (avgGain * (n - 1) + gain) / n;
    avgLoss = (avgLoss * (n - 1) + loss) / n;
    out[i] = rsiFrom(avgGain, avgLoss);
  }
  return out;
}

function rsiFrom(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function trueRange(high: number[], low: number[], close: number[]): number[] {
  const tr = new Array<number>(close.length).fill(NaN);
  if (close.length === 0) return tr;
  tr[0] = high[0]! - low[0]!;
  for (let i = 1; i < close.length; i++) {
    tr[i] = Math.max(
      high[i]! - low[i]!,
      Math.abs(high[i]! - close[i - 1]!),
      Math.abs(low[i]! - close[i - 1]!),
    );
  }
  return tr;
}

/** ATR Wilder 14: first mean of n TRs, then Wilder smooth. */
export function atrWilder(
  high: number[],
  low: number[],
  close: number[],
  n = ATR_PERIOD,
): number[] {
  const tr = trueRange(high, low, close);
  const out = new Array<number>(close.length).fill(NaN);
  if (close.length < n) return out;
  let atr = 0;
  for (let i = 0; i < n; i++) atr += tr[i]!;
  atr /= n;
  out[n - 1] = atr;
  for (let i = n; i < close.length; i++) {
    atr = (atr * (n - 1) + tr[i]!) / n;
    out[i] = atr;
  }
  return out;
}

export function macd(closes: number[]): { line: number[]; signal: number[]; hist: number[] } {
  const fast = ema(closes, MACD_FAST);
  const slow = ema(closes, MACD_SLOW);
  const line = closes.map((_, i) => fast[i]! - slow[i]!);
  const signal = ema(line, MACD_SIGNAL);
  const hist = line.map((v, i) => v - signal[i]!);
  return { line, signal, hist };
}

export function bollinger(closes: number[], period = BB_PERIOD, k = BB_K) {
  const mb = sma(closes, period);
  const sd = rollingStdev(closes, period);
  const ub = mb.map((m, i) => m + k * sd[i]!);
  const lb = mb.map((m, i) => m - k * sd[i]!);
  const bbPos = closes.map((c, i) => {
    const span = ub[i]! - lb[i]!;
    if (!Number.isFinite(span) || span === 0) return 0.5;
    return Math.min(1, Math.max(0, (c - lb[i]!) / span));
  });
  const bbWidth = mb.map((m, i) => {
    if (!Number.isFinite(m) || m === 0) return NaN;
    return (ub[i]! - lb[i]!) / m;
  });
  return { mb, ub, lb, bbPos, bbWidth, sd };
}

export function logReturns(closes: number[]): number[] {
  const r = new Array<number>(closes.length).fill(NaN);
  for (let i = 1; i < closes.length; i++) {
    r[i] = logReturn(closes[i]!, closes[i - 1]!);
  }
  return r;
}

/** Realized close-to-close vol over the last `hours` hourly bars — already on that horizon. */
export function sigmaCc(returns: number[], hours: number): number {
  const slice = returns.filter((x) => Number.isFinite(x)).slice(-hours);
  if (slice.length === 0) return 0;
  let s = 0;
  for (const r of slice) s += r * r;
  return Math.sqrt(s);
}

/** Parkinson vol over the last `hours` bars. */
export function sigmaParkinson(candles: Candle[], hours: number): number {
  const slice = candles.slice(-hours);
  if (slice.length === 0) return 0;
  let s = 0;
  for (const c of slice) {
    if (c.high > 0 && c.low > 0 && c.high >= c.low) {
      const lr = Math.log(c.high / c.low);
      s += lr * lr;
    }
  }
  return Math.sqrt((1 / (4 * Math.log(2))) * s);
}

export function volRatio(volumes: number[], period = VOL_SMA_PERIOD): number {
  const vSma = sma(volumes, period);
  const lastV = volumes[volumes.length - 1] ?? 0;
  const lastS = lastFinite(vSma);
  if (!Number.isFinite(lastS) || lastS === 0) return 1;
  return lastV / lastS;
}

export function closesOf(c: Candle[]): number[] {
  return c.map((x) => x.close);
}
export function highsOf(c: Candle[]): number[] {
  return c.map((x) => x.high);
}
export function lowsOf(c: Candle[]): number[] {
  return c.map((x) => x.low);
}
export function volumesOf(c: Candle[]): number[] {
  return c.map((x) => x.volume);
}

export function lastClose(c: Candle[]): number {
  return c[c.length - 1]?.close ?? NaN;
}

export function sigmaCcHours(candles: Candle[], hours: number): number {
  return sigmaCc(logReturns(closesOf(candles)), hours);
}

export function realizedReturn(candles: Candle[], hours: number): number {
  if (candles.length < hours + 1) {
    if (candles.length < 2) return 0;
    return logReturn(lastClose(candles), candles[0]!.close);
  }
  const now = lastClose(candles);
  const prev = candles[candles.length - 1 - hours]!.close;
  return logReturn(now, prev);
}

export function rollingMedian(xs: number[], window: number): number {
  const slice = xs.filter((v) => Number.isFinite(v)).slice(-window);
  if (slice.length === 0) return 0;
  const a = slice.slice().sort((p, q) => p - q);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

export { lastFinite, sma, stdev, SIGMA_CC_HOURS_24, SIGMA_CC_HOURS_48, EMA_FAST };

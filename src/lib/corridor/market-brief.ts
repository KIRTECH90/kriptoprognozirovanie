import type { Candle } from "./types.ts";
import { lastClose, realizedReturn } from "./indicators.ts";
import { formatPct } from "../format.ts";

export function candleRange(candles: Candle[], n: number): { high: number; low: number } {
  if (!candles.length) return { high: NaN, low: NaN };
  const slice = candles.length <= n ? candles : candles.slice(-n);
  let high = -Infinity;
  let low = Infinity;
  for (const c of slice) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  return { high, low };
}

export function pctFromLog(r: number): number {
  if (!Number.isFinite(r)) return 0;
  return Math.exp(r) - 1;
}

export function buildMarketNote(opts: {
  name: string;
  price: number;
  r24: number;
  r7: number;
  r30: number;
  low30: number;
  high30: number;
}): string {
  const d24 = pctFromLog(opts.r24);
  const d7 = pctFromLog(opts.r7);
  const d30 = pctFromLog(opts.r30);
  const span = opts.high30 - opts.low30;
  const pos = span > 0 ? (opts.price - opts.low30) / span : 0.5;

  let day: string;
  if (d24 <= -0.04) day = `За сутки ${opts.name} заметно просела (${formatPct(d24)})`;
  else if (d24 >= 0.04) day = `За сутки ${opts.name} заметно выросла (${formatPct(d24)})`;
  else if (d24 < -0.01) day = `За сутки лёгкий откат (${formatPct(d24)})`;
  else if (d24 > 0.01) day = `За сутки лёгкий плюс (${formatPct(d24)})`;
  else day = `За сутки ход тихий (${formatPct(d24)})`;

  let week: string;
  if (d7 <= -0.08) week = `неделя слабая (${formatPct(d7)})`;
  else if (d7 >= 0.08) week = `неделя сильная (${formatPct(d7)})`;
  else week = `за неделю ${formatPct(d7)}`;

  let month: string;
  if (d30 <= -0.15) month = `месяц в минусе (${formatPct(d30)})`;
  else if (d30 >= 0.15) month = `месяц в плюсе (${formatPct(d30)})`;
  else month = `за месяц ${formatPct(d30)}`;

  let place: string;
  if (pos >= 0.82) place = "Цена у верхней границы месяца.";
  else if (pos <= 0.18) place = "Цена у нижней границы месяца.";
  else place = "Цена около середины месячного диапазона.";

  return `${day}; ${week}, ${month}. ${place}`;
}

export function periodReturns(h1: Candle[], d1: Candle[]): {
  r24: number;
  r7: number;
  r30: number;
  high24: number;
  low24: number;
  high30: number;
  low30: number;
} {
  const r24 = realizedReturn(h1, 24);
  const r7 = realizedReturn(h1, 24 * 7);
  const r30 = d1.length >= 31 ? realizedReturn(d1, 30) : realizedReturn(h1, Math.min(24 * 30, Math.max(h1.length - 1, 1)));
  const d24 = candleRange(h1, 24);
  const d30 = d1.length >= 20 ? candleRange(d1, 30) : candleRange(h1, Math.min(h1.length, 24 * 30));
  return {
    r24,
    r7,
    r30,
    high24: d24.high,
    low24: d24.low,
    high30: d30.high,
    low30: d30.low,
  };
}

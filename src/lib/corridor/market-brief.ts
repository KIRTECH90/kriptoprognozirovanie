import type { Candle } from "./types.ts";
import { realizedReturn } from "./indicators.ts";
import { formatPct } from "../format.ts";
import { clip } from "./math.ts";

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

export function rangePos(price: number, low: number, high: number): number {
  const span = high - low;
  if (!(span > 0) || !Number.isFinite(price)) return 0.5;
  return clip((price - low) / span, 0, 1);
}

function movePhrase(pct: number, strong: number, mild: number): string {
  if (pct <= -strong) return `заметное падение (${formatPct(pct)})`;
  if (pct >= strong) return `заметный рост (${formatPct(pct)})`;
  if (pct <= -mild) return `лёгкий откат (${formatPct(pct)})`;
  if (pct >= mild) return `лёгкий плюс (${formatPct(pct)})`;
  return `ход тихий (${formatPct(pct)})`;
}

export function buildMarketNote(opts: {
  name: string;
  price: number;
  r24: number;
  r7: number;
  r30: number;
  low24: number;
  high24: number;
  low30: number;
  high30: number;
  fgValue: number | null;
}): string {
  const d24 = pctFromLog(opts.r24);
  const d7 = pctFromLog(opts.r7);
  const d30 = pctFromLog(opts.r30);
  const pos = rangePos(opts.price, opts.low30, opts.high30);
  const daySpan = opts.price > 0 && Number.isFinite(opts.high24) && Number.isFinite(opts.low24)
    ? (opts.high24 - opts.low24) / opts.price
    : 0;

  const dayMove = movePhrase(d24, 0.04, 0.01);
  let daySpanNote = "";
  if (daySpan >= 0.055) daySpanNote = ", диапазон широкий";
  else if (daySpan > 0 && daySpan <= 0.018) daySpanNote = ", диапазон узкий";

  const week = formatPct(d7);
  const month = formatPct(d30);
  let longer: string;
  if (d7 <= -0.06 && d30 <= -0.08) longer = `За неделю ${week} и за месяц ${month} — ход вниз.`;
  else if (d7 >= 0.06 && d30 >= 0.08) longer = `За неделю ${week} и за месяц ${month} — ход вверх.`;
  else if (Math.abs(d7) < 0.02 && Math.abs(d30) < 0.04) longer = `За неделю ${week}, за месяц ${month} — без сильного тренда.`;
  else longer = `За неделю ${week}, за месяц ${month}.`;

  let place: string;
  if (pos >= 0.82) place = "Цена у верхней границы месяца.";
  else if (pos <= 0.18) place = "Цена у нижней границы месяца.";
  else if (pos >= 0.62) place = "Цена в верхней части месячного хода.";
  else if (pos <= 0.38) place = "Цена в нижней части месячного хода.";
  else place = "Цена около середины месячного диапазона.";

  let mood = "";
  if (opts.fgValue != null) {
    if (opts.fgValue <= 24) mood = " Настроение рынка — крайний страх.";
    else if (opts.fgValue <= 44) mood = " Настроение рынка — страх.";
    else if (opts.fgValue <= 55) mood = "";
    else if (opts.fgValue <= 74) mood = " Настроение рынка — жадность.";
    else mood = " Настроение рынка — крайняя жадность.";
  }

  return `За сутки ${opts.name} — ${dayMove}${daySpanNote}. ${longer} ${place}${mood}`;
}

export function periodReturns(h1: Candle[], d1: Candle[]): {
  r24: number;
  r7: number;
  r30: number;
  high24: number;
  low24: number;
  high7: number;
  low7: number;
  high30: number;
  low30: number;
} {
  const r24 = realizedReturn(h1, 24);
  const r7 = realizedReturn(h1, 24 * 7);
  const r30 = d1.length >= 31 ? realizedReturn(d1, 30) : realizedReturn(h1, Math.min(24 * 30, Math.max(h1.length - 1, 1)));
  const d24 = candleRange(h1, 24);
  const d7 = candleRange(h1, Math.min(h1.length, 24 * 7));
  const d30 = d1.length >= 20 ? candleRange(d1, 30) : candleRange(h1, Math.min(h1.length, 24 * 30));
  return {
    r24,
    r7,
    r30,
    high24: d24.high,
    low24: d24.low,
    high7: d7.high,
    low7: d7.low,
    high30: d30.high,
    low30: d30.low,
  };
}

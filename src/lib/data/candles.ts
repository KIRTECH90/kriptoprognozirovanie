import type { Candle } from "@/lib/corridor/types.ts";

export function parseBinanceKlines(raw: unknown): Candle[] {
  if (!Array.isArray(raw)) return [];
  const out: Candle[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const openTime = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);
    if (![openTime, open, high, low, close, volume].every(Number.isFinite)) continue;
    out.push({ openTime, open, high, low, close, volume });
  }
  return out;
}

export function compactToCandles(
  rows: [number, number, number, number, number, number][],
): Candle[] {
  return rows.map(([openTime, open, high, low, close, volume]) => ({
    openTime,
    open,
    high,
    low,
    close,
    volume,
  }));
}

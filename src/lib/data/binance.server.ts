import {
  BINANCE_HOSTS,
  FETCH_TIMEOUT_MS,
  KLINES_15M,
  KLINES_1H,
  KLINES_4H,
  KLINES_1D,
  SYMBOL,
} from "@/lib/corridor/config.ts";
import type { Candle, CandleSet } from "@/lib/corridor/types.ts";
import snapshot from "./snapshots/btcusdt.json";
import { compactToCandles, parseBinanceKlines } from "./candles.ts";

type SnapshotFile = {
  symbol: string;
  fetched_at: number;
  klines: {
    "15m": [number, number, number, number, number, number][];
    "1h": [number, number, number, number, number, number][];
    "4h": [number, number, number, number, number, number][];
    "1d": [number, number, number, number, number, number][];
  };
};

const SNAP = snapshot as SnapshotFile;

const lastGood = new Map<string, CandleSet>();

export function loadSnapshotCandles(): { candles: CandleSet; fetchedAt: number } {
  return {
    fetchedAt: SNAP.fetched_at,
    candles: {
      m15: compactToCandles(SNAP.klines["15m"]),
      h1: compactToCandles(SNAP.klines["1h"]),
      h4: compactToCandles(SNAP.klines["4h"]),
      d1: compactToCandles(SNAP.klines["1d"]),
    },
  };
}

async function fetchKlinesFrom(
  host: string,
  interval: string,
  limit: number,
  symbol: string,
): Promise<Candle[]> {
  const url = `${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Corridor/1.0" },
    });
    if (!res.ok) throw new Error(`klines ${interval} ${res.status}`);
    const json: unknown = await res.json();
    const candles = parseBinanceKlines(json);
    if (candles.length < 10) throw new Error(`klines ${interval} empty`);
    return candles;
  } finally {
    clearTimeout(t);
  }
}

async function fetchTf(interval: string, limit: number, symbol: string): Promise<Candle[]> {
  let lastErr: unknown;
  for (const host of BINANCE_HOSTS) {
    try {
      return await fetchKlinesFrom(host, interval, limit, symbol);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchLiveCandles(symbol = SYMBOL): Promise<{
  candles: CandleSet;
  stale: boolean;
  source: "live" | "snapshot";
}> {
  try {
    const [m15, h1, h4, d1] = await Promise.all([
      fetchTf("15m", KLINES_15M, symbol),
      fetchTf("1h", KLINES_1H, symbol),
      fetchTf("4h", KLINES_4H, symbol),
      fetchTf("1d", KLINES_1D, symbol),
    ]);
    const candles = { m15, h1, h4, d1 };
    lastGood.set(symbol, candles);
    return { candles, stale: false, source: "live" };
  } catch (e) {
    const cached = lastGood.get(symbol);
    if (cached) return { candles: cached, stale: true, source: "snapshot" };
    if (symbol === "BTCUSDT") {
      const snap = loadSnapshotCandles();
      return { candles: snap.candles, stale: true, source: "snapshot" };
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

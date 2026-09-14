import { DEFAULT_CALIBRATION, SYMBOL, UPDATE_MINUTES } from "./config.ts";
import { runEngine } from "./engine.ts";
import { walkForwardCalibrate } from "./calibrate.ts";
import { fetchLiveCandles } from "@/lib/data/binance.server.ts";
import { fetchFearGreed } from "@/lib/data/fear-greed.server.ts";
import { fetchNews } from "@/lib/data/news.server.ts";
import { getAsset, isKnownSymbol, parseSymbol } from "@/lib/markets.ts";
import {
  getCache,
  latestAny,
  metricsFromLogs,
  rememberForecast,
  setCalibration,
} from "@/lib/store/forecasts.server.ts";
import type { ForecastBundle, ForecastResponse, NewsItem } from "./types.ts";

const TTL_MS = UPDATE_MINUTES * 60_000;

function filterNews(items: NewsItem[], symbol: string): NewsItem[] {
  const { asset } = parseSymbol(symbol);
  const keys = getAsset(asset).keywords;
  const hit = items.filter((n) => {
    const hay = `${n.title} ${n.rawText}`.toLowerCase();
    return keys.some((k) => hay.includes(k));
  });
  return hit;
}

export async function buildForecast(opts?: {
  forceRefresh?: boolean;
  symbol?: string;
}): Promise<ForecastBundle> {
  const symbol = (opts?.symbol ?? SYMBOL).toUpperCase();
  if (!isKnownSymbol(symbol)) {
    throw new Error("UNKNOWN_PAIR");
  }
  const cache = getCache(symbol);
  if (!opts?.forceRefresh && cache.bundle && Date.now() - cache.lastAt < TTL_MS) {
    return cache.bundle;
  }

  const [klines, news, fg] = await Promise.all([
    fetchLiveCandles(symbol),
    fetchNews(),
    fetchFearGreed(),
  ]);

  const bundle = runEngine({
    symbol,
    candles: klines.candles,
    news: filterNews(news.items, symbol),
    fearGreed: fg,
    staleCandles: klines.stale,
    staleNews: news.staleNews,
    prevSigma24: cache.prevSigma24,
    prevSigma48: cache.prevSigma48,
    calibration: cache.calibration,
    now: Date.now(),
    source: klines.source,
  });
  rememberForecast(bundle);
  return bundle;
}

export async function buildForecastApi(
  symbol = SYMBOL,
  forceRefresh = false,
): Promise<ForecastResponse> {
  const bundle = await buildForecast({ forceRefresh, symbol });
  return bundle.api;
}

export function healthPayload() {
  const latest = latestAny();
  return {
    ok: true,
    symbol: latest?.api.symbol ?? SYMBOL,
    last_forecast_ts: latest?.api.ts ?? null,
    stale: latest?.api.stale ?? null,
    cached: Boolean(latest),
  };
}

export function metricsPayload() {
  const m = metricsFromLogs();
  const cache = getCache(SYMBOL);
  return {
    window: "session",
    logs: m.n,
    coverage_24: m.coverage_24,
    coverage_48: m.coverage_48,
    median_width_24: m.median_width_24,
    median_width_48: m.median_width_48,
    target_coverage_24: 0.75,
    target_coverage_48: 0.8,
    calibration: cache.calibration,
  };
}

export async function runCalibration() {
  const klines = await fetchLiveCandles("BTCUSDT");
  const result = walkForwardCalibrate({
    h1: klines.candles.h1,
    h4: klines.candles.h4,
    d1: klines.candles.d1,
    m15: klines.candles.m15,
  });
  setCalibration(result.calibration, "BTCUSDT");
  return result;
}

export { DEFAULT_CALIBRATION };

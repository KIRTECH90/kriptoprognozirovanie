import { DEFAULT_CALIBRATION, SYMBOL, UPDATE_MINUTES } from "./config.ts";
import { runEngine } from "./engine.ts";
import { journalFromWalk, liveJournalFromRows, type LiveJournalPayload, type ModelPayload } from "./journal.ts";
import { walkForwardCalibrate } from "./calibrate.ts";
import {
  issueForecast,
  loadCalibration,
  loadLiveJournal,
  saveCalibration,
  settleIssued,
} from "./persist.server.ts";
import { fetchLiveCandles } from "@/lib/data/binance.server.ts";
import { fetchDerivatives } from "@/lib/data/derivatives.server.ts";
import { fetchFearGreed } from "@/lib/data/fear-greed.server.ts";
import { fetchNews } from "@/lib/data/news.server.ts";
import { getAsset, isKnownSymbol, matchesKeywords, parseSymbol } from "@/lib/markets.ts";
import {
  expireForecast,
  getCache,
  getJournalCache,
  latestAny,
  metricsFromLogs,
  rememberForecast,
  setCalibration,
  setJournalCache,
} from "@/lib/store/forecasts.server.ts";
import type { ForecastBundle, ForecastResponse, NewsItem } from "./types.ts";

const TTL_MS = UPDATE_MINUTES * 60_000;
const CAL_TTL_MS = 6 * 3600_000;
const journalInflight = new Map<string, Promise<ModelPayload>>();

function filterNews(items: NewsItem[], symbol: string): NewsItem[] {
  const { asset } = parseSymbol(symbol);
  const keys = getAsset(asset).keywords;
  return items.filter((n) => matchesKeywords(`${n.title} ${n.rawText}`, keys));
}

function calibrationFresh(symbol: string): boolean {
  const cal = getCache(symbol).calibration;
  if (!cal.updated_at || cal.last_coverage_24 == null) return false;
  const t = Date.parse(cal.updated_at);
  return Number.isFinite(t) && Date.now() - t < CAL_TTL_MS;
}

function scheduleCalibration(symbol: string) {
  if (calibrationFresh(symbol)) return;
  const cached = getJournalCache(symbol);
  if (cached && Date.now() - cached.at < TTL_MS) return;
  if (journalInflight.has(symbol)) return;
  void buildModelAudit(symbol).catch(() => {
    /* first paint stays uncalibrated; next refresh retries */
  });
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
    try {
      await issueForecast(cache.bundle);
    } catch {
      /* first journal row can wait for a live refresh */
    }
    return cache.bundle;
  }

  let calibration = cache.calibration;
  if (!calibration.updated_at) {
    try {
      const fromDb = await loadCalibration(symbol);
      if (fromDb) {
        setCalibration(fromDb, symbol);
        calibration = fromDb;
      }
    } catch {
      /* preview DB might still be migrating */
    }
  }

  const [klines, news, fg, deriv] = await Promise.all([
    fetchLiveCandles(symbol),
    fetchNews(),
    fetchFearGreed(),
    fetchDerivatives(symbol),
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
    calibration,
    now: Date.now(),
    source: klines.source,
    derivatives: deriv,
  });
  rememberForecast(bundle);
  try {
    await issueForecast(bundle);
    await settleIssued(symbol, klines.candles.h1);
  } catch {
    /* journal write is best-effort; corridor still shows */
  }
  scheduleCalibration(symbol);
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

export async function runCalibration(symbol = "BTCUSDT") {
  const klines = await fetchLiveCandles(symbol);
  const result = walkForwardCalibrate({
    h1: klines.candles.h1,
    h4: klines.candles.h4,
    d1: klines.candles.d1,
    m15: klines.candles.m15,
    symbol,
    stepHours: 24,
  });
  setCalibration(result.calibration, symbol);
  expireForecast(symbol);
  try {
    await saveCalibration(symbol, result.calibration);
  } catch {
    /* memory still holds it */
  }
  return result;
}

export async function buildLiveJournal(symbol: string): Promise<LiveJournalPayload> {
  const u = symbol.toUpperCase();
  if (!isKnownSymbol(u)) throw new Error("UNKNOWN_PAIR");
  try {
    const klines = await fetchLiveCandles(u);
    await settleIssued(u, klines.candles.h1);
  } catch {
    /* show whatever is already stored */
  }
  try {
    return await loadLiveJournal(u);
  } catch {
    return liveJournalFromRows(u, []);
  }
}

export async function buildModelAudit(symbol: string): Promise<ModelPayload> {
  const u = symbol.toUpperCase();
  if (!isKnownSymbol(u)) throw new Error("UNKNOWN_PAIR");
  const cached = getJournalCache(u);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.payload;
  const inflight = journalInflight.get(u);
  if (inflight) return inflight;
  const job = (async () => {
    const klines = await fetchLiveCandles(u);
    const wf = walkForwardCalibrate({
      h1: klines.candles.h1,
      h4: klines.candles.h4,
      d1: klines.candles.d1,
      m15: klines.candles.m15,
      symbol: u,
      stepHours: 24,
    });
    setCalibration(wf.calibration, u);
    expireForecast(u);
    try {
      await saveCalibration(u, wf.calibration);
    } catch {
      /* memory still holds it */
    }
    const payload = journalFromWalk(u, wf);
    setJournalCache(u, payload);
    return payload;
  })();
  journalInflight.set(u, job);
  try {
    return await job;
  } finally {
    journalInflight.delete(u);
  }
}

/** @deprecated use buildModelAudit */
export const buildJournal = buildModelAudit;

export { DEFAULT_CALIBRATION };

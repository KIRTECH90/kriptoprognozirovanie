import {
  BB_MEDIAN_DAYS,
  DISCLAIMER,
  SYMBOL,
  TARGET_COV_24,
  TARGET_COV_48,
  WIDTH_DECIMALS,
} from "./config.ts";
import { computeCenters, taScore } from "./center.ts";
import { buildDrivers, confidenceOf } from "./drivers.ts";
import {
  bollinger,
  closesOf,
  lastClose,
  lastFinite,
  realizedReturn,
  rollingMedian,
  volRatio,
  volumesOf,
} from "./indicators.ts";
import { buildCorridors, computeWidthMultiplier, empiricalQuantiles } from "./interval.ts";
import { buildMarketNote, periodReturns } from "./market-brief.ts";
import { buildLevelsNote, findLevels, roundLevels } from "./levels.ts";
import { roundTo } from "./math.ts";
import { scoreNews } from "./news-score.ts";
import { regimeFromSets } from "./regime.ts";
import type { EngineInput, ForecastBundle, HorizonBand, ScoredNews } from "./types.ts";
import { buildVerdict } from "./verdict.ts";
import { computeSigmas } from "./volatility.ts";
import { priceDecimals } from "../format.ts";
import { getAsset, parseSymbol, widthCapMult } from "../markets.ts";

function finishHorizon(h: HorizonBand, decimals: number): HorizonBand {
  return {
    center: roundTo(h.center, decimals),
    expected: roundTo(h.center, decimals),
    low: roundTo(h.low, decimals),
    high: roundTo(h.high, decimals),
    width_pct: roundTo(h.width_pct, WIDTH_DECIMALS),
    target_coverage: h.target_coverage,
  };
}

function pickHeadlines(items: ScoredNews[], asset: string): {
  items: ForecastBundle["details"]["headlines"];
  scope: "asset" | "market";
} {
  const keys = getAsset(asset).keywords;
  const id = asset.toUpperCase();
  const relevant = items.filter((n) => {
    const hay = `${n.title} ${n.rawText} ${n.coins.join(" ")}`.toLowerCase();
    return n.coins.some((c) => c.toUpperCase() === id) || keys.some((k) => hay.includes(k));
  });
  const src = relevant;
  return {
    scope: relevant.length ? "asset" : "market",
    items: src.slice(0, 4).map((n) => ({
      title: n.title,
      source: n.source,
      url: n.url,
      publishedAt: n.publishedAt,
      polarity: n.polarity,
    })),
  };
}

export function runEngine(input: EngineInput): ForecastBundle {
  const { candles } = input;
  const p0 = lastClose(candles.h1.length ? candles.h1 : candles.h4);
  const newsAgg = scoreNews(input.news, input.now);
  const newsShock = input.staleNews ? 0 : newsAgg.newsShock;
  const newsShift = input.staleNews ? 0 : newsAgg.newsShift;

  const snap = regimeFromSets({
    h1: candles.h1,
    h4: candles.h4,
    d1: candles.d1,
    newsShock,
  });

  const sig = computeSigmas(candles.h1, candles.h4, input.prevSigma24, input.prevSigma48);
  const { sTa, rsi } = taScore({ trend4h: snap.trend4h, h1: candles.h1 });
  const r24 = realizedReturn(candles.h1, 24);
  const r48 = realizedReturn(candles.h1, 48);
  const periods = periodReturns(candles.h1, candles.d1);
  const assetId = parseSymbol(input.symbol).asset;
  const assetName = getAsset(assetId).name;
  const centers = computeCenters({
    p0,
    sTa,
    sigma24: sig.sigma24,
    sigma48: sig.sigma48,
    rLast24: r24,
    rLast48: r48,
    newsShift,
    fg: input.fearGreed,
  });

  const bb = bollinger(closesOf(candles.h1));
  const bbWidth = lastFinite(bb.bbWidth);
  const bbPos = lastFinite(bb.bbPos);
  const bbWidthMedian30d = rollingMedian(bb.bbWidth, BB_MEDIAN_DAYS * 24);
  const vRatioH1 = volRatio(volumesOf(candles.h1));
  const vRatioM15 = candles.m15.length >= 20 ? volRatio(volumesOf(candles.m15), 20) : 1;
  const vRatio = Math.max(vRatioH1, Number.isFinite(vRatioM15) ? vRatioM15 : 1);

  const w = computeWidthMultiplier({
    regime: snap.regime,
    event: snap.event,
    newsShock,
    bbWidth: Number.isFinite(bbWidth) ? bbWidth : 0,
    bbWidthMedian30d,
    rsi,
    trend1h: snap.trend1h,
    trend4h: snap.trend4h,
    trend1d: snap.trend1d,
    volRatio: vRatio,
    stale: input.staleCandles,
  });

  let emp24: { qLo: number; qHi: number } | null = null;
  let emp48: { qLo: number; qHi: number } | null = null;
  if (candles.h1.length >= 260 && snap.regime !== "EVENT" && !input.skipEmpirical) {
    const e24 = empiricalQuantiles({
      h1: candles.h1,
      h4: candles.h4,
      d1: candles.d1,
      regimeNow: snap.regime,
      sigmaNow: sig.sigma24,
      horizonHours: 24,
    });
    const e48 = empiricalQuantiles({
      h1: candles.h1,
      h4: candles.h4,
      d1: candles.d1,
      regimeNow: snap.regime,
      sigmaNow: sig.sigma48,
      horizonHours: 48,
    });
    if (e24) emp24 = { qLo: e24.qLo, qHi: e24.qHi };
    if (e48) emp48 = { qLo: e48.qLo, qHi: e48.qHi };
  }

  const { h24, h48 } = buildCorridors({
    p0,
    mu24: centers.mu24,
    mu48: centers.mu48,
    sigma24: sig.sigma24,
    sigma48: sig.sigma48,
    w,
    rsi,
    newsShift,
    regime: snap.regime,
    calibration: input.calibration,
    empirical24: emp24,
    empirical48: emp48,
    capMult: widthCapMult(assetId),
  });

  const decimals = priceDecimals(p0);
  const band24 = finishHorizon(h24, decimals);
  const band48 = finishHorizon(h48, decimals);

  const conf = confidenceOf({
    regime: snap.regime,
    newsShock,
    tfAligned: snap.tfAligned,
    stale: input.staleCandles,
    empirical: emp24 ? true : input.skipEmpirical ? undefined : false,
  });
  const topType = newsAgg.items[0]?.type;
  const drivers = buildDrivers({
    regime: snap.regime,
    event: snap.event,
    rsi,
    newsShock,
    newsType: topType,
    tfAligned: snap.tfAligned,
    trend1h: snap.trend1h,
    stale: input.staleCandles,
    w,
    width24: band24.width_pct,
    expected24: band24.expected,
    price: p0,
    fgValue: input.fearGreed?.value ?? null,
    fgClass: input.fearGreed?.classification ?? null,
    headline: newsAgg.items[0]?.title,
  });

  const ts = new Date(input.now).toISOString().replace(/\.\d{3}Z$/, "Z");
  const newsPick = pickHeadlines(newsAgg.items, assetId);
  const found = findLevels({
    h1: candles.h1,
    d1: candles.d1,
    price: p0,
    high24: periods.high24,
    low24: periods.low24,
    high7: periods.high7,
    low7: periods.low7,
    high30: periods.high30,
    low30: periods.low30,
  });
  const levels = roundLevels(found.levels, decimals);
  const levelsNote = buildLevelsNote(roundTo(p0, decimals), levels);
  const verdict = buildVerdict({
    price: p0,
    expected24: band24.expected,
    expected48: band48.expected,
    low24: band24.low,
    high24: band24.high,
    muRaw24: centers.muRaw24,
    regime: snap.regime,
    event: snap.event,
    newsShock,
    confidence: conf,
    rsi,
    trend1h: snap.trend1h,
    trend4h: snap.trend4h,
    trend1d: snap.trend1d,
    tfAligned: snap.tfAligned,
    stale: input.staleCandles,
    low30: Number.isFinite(periods.low30) ? periods.low30 : p0,
    high30: Number.isFinite(periods.high30) ? periods.high30 : p0,
  });
  const api = {
    symbol: input.symbol || SYMBOL,
    ts,
    price: roundTo(p0, decimals),
    horizon_24h: band24,
    horizon_48h: band48,
    regime: snap.regime,
    confidence: conf,
    drivers,
    verdict,
    disclaimer: DISCLAIMER,
    stale: input.staleCandles,
  };

  return {
    api,
    details: {
      rsi,
      atrPct1h: snap.atrPct1h,
      atrPct4h: snap.atrPct4h,
      sigma24: sig.sigma24,
      sigma48: sig.sigma48,
      mu24: centers.mu24,
      mu48: centers.mu48,
      muRaw24: centers.muRaw24,
      muRaw48: centers.muRaw48,
      realized24: periods.r24,
      realized7d: periods.r7,
      realized30d: periods.r30,
      high24: Number.isFinite(periods.high24) ? roundTo(periods.high24, decimals) : roundTo(p0, decimals),
      low24: Number.isFinite(periods.low24) ? roundTo(periods.low24, decimals) : roundTo(p0, decimals),
      high7: Number.isFinite(periods.high7) ? roundTo(periods.high7, decimals) : roundTo(p0, decimals),
      low7: Number.isFinite(periods.low7) ? roundTo(periods.low7, decimals) : roundTo(p0, decimals),
      high30: Number.isFinite(periods.high30) ? roundTo(periods.high30, decimals) : roundTo(p0, decimals),
      low30: Number.isFinite(periods.low30) ? roundTo(periods.low30, decimals) : roundTo(p0, decimals),
      marketNote: buildMarketNote({
        name: assetName,
        price: p0,
        r24: periods.r24,
        r7: periods.r7,
        r30: periods.r30,
        low24: periods.low24,
        high24: periods.high24,
        low30: periods.low30,
        high30: periods.high30,
        fgValue: input.fearGreed?.value ?? null,
      }),
      levels,
      levelsNote,
      w,
      newsShift,
      newsShock,
      fgValue: input.fearGreed?.value ?? null,
      fgClass: input.fearGreed?.classification ?? null,
      fgAdj: centers.fgAdj,
      volRatio: vRatioH1,
      volRatioM15: Number.isFinite(vRatioM15) ? vRatioM15 : 1,
      empirical24: Boolean(emp24),
      empirical48: Boolean(emp48),
      bbWidth: Number.isFinite(bbWidth) ? bbWidth : 0,
      bbPos: Number.isFinite(bbPos) ? bbPos : 0.5,
      event: snap.event,
      staleNews: input.staleNews,
      trend1h: snap.trend1h,
      trend4h: snap.trend4h,
      trend1d: snap.trend1d,
      tfAligned: snap.tfAligned,
      sTa,
      source: input.source,
      headlines: newsPick.items,
      newsScope: newsPick.scope,
      calibration: input.calibration,
    },
  };
}

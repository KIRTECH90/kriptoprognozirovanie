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
import { clip, roundTo } from "./math.ts";
import { scoreNews } from "./news-score.ts";
import { regimeFromSets } from "./regime.ts";
import type { EngineInput, ForecastBundle, HorizonBand } from "./types.ts";
import { computeSigmas } from "./volatility.ts";
import { priceDecimals } from "../format.ts";

function finishHorizon(h: HorizonBand, p0: number, muRaw: number, decimals: number): HorizonBand {
  const raw = p0 * Math.exp(muRaw);
  const expected = roundTo(clip(raw, h.low, h.high), decimals);
  return {
    center: roundTo(h.center, decimals),
    expected,
    low: roundTo(h.low, decimals),
    high: roundTo(h.high, decimals),
    width_pct: roundTo(h.width_pct, WIDTH_DECIMALS),
    target_coverage: h.target_coverage,
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
  const vRatio = volRatio(volumesOf(candles.h1));

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
    looseCaps: !/^(BTC|ETH)/.test(input.symbol),
  });

  const decimals = priceDecimals(p0);
  const band24 = finishHorizon(h24, p0, centers.muRaw24, decimals);
  const band48 = finishHorizon(h48, p0, centers.muRaw48, decimals);

  const conf = confidenceOf({
    regime: snap.regime,
    newsShock,
    tfAligned: snap.tfAligned,
    stale: input.staleCandles,
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
  const api = {
    symbol: input.symbol || SYMBOL,
    ts,
    price: roundTo(p0, decimals),
    horizon_24h: band24,
    horizon_48h: band48,
    regime: snap.regime,
    confidence: conf,
    drivers,
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
      realized24: r24,
      w,
      newsShift,
      newsShock,
      fgValue: input.fearGreed?.value ?? null,
      fgClass: input.fearGreed?.classification ?? null,
      fgAdj: centers.fgAdj,
      volRatio: vRatio,
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
      headlines: newsAgg.items.slice(0, 5).map((n) => ({
        title: n.title,
        type: n.type,
        polarity: n.polarity,
      })),
      calibration: input.calibration,
    },
  };
}

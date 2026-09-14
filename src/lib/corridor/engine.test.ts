import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CALIBRATION } from "./config.ts";
import { runEngine } from "./engine.ts";
import type { Candle } from "./types.ts";

function series(n: number, start: number, stepMs: number, p0: number, vol: number): Candle[] {
  const out: Candle[] = [];
  let p = p0;
  for (let i = 0; i < n; i++) {
    const shock = Math.sin(i / 9) * vol;
    const open = p;
    p = p * Math.exp(shock);
    const high = Math.max(open, p) * (1 + vol * 0.3);
    const low = Math.min(open, p) * (1 - vol * 0.3);
    out.push({
      openTime: start + i * stepMs,
      open,
      high,
      low,
      close: p,
      volume: 50 + (i % 7) * 10,
    });
  }
  return out;
}

describe("engine", () => {
  it("produces L < M < H corridors with min width", () => {
    const t0 = Date.UTC(2025, 0, 1);
    const h1 = series(300, t0, 3600_000, 100_000, 0.004);
    const h4 = series(120, t0, 4 * 3600_000, 100_000, 0.008);
    const d1 = series(80, t0, 86400_000, 100_000, 0.015);
    const bundle = runEngine({
      symbol: "BTCUSDT",
      candles: { m15: h1, h1, h4, d1 },
      news: [],
      fearGreed: { value: 50, classification: "Neutral" },
      staleCandles: false,
      staleNews: true,
      prevSigma24: null,
      prevSigma48: null,
      calibration: DEFAULT_CALIBRATION,
      now: t0 + 299 * 3600_000,
      source: "snapshot",
      skipEmpirical: true,
    });
    const a = bundle.api;
    assert.ok(a.horizon_24h.low < a.horizon_24h.center);
    assert.ok(a.horizon_24h.center < a.horizon_24h.high);
    assert.ok(a.horizon_24h.width_pct >= 0.012 - 1e-9);
    assert.ok(a.horizon_48h.width_pct >= 0.018 - 1e-9);
    assert.ok(a.horizon_24h.low <= a.horizon_24h.expected);
    assert.ok(a.horizon_24h.expected <= a.horizon_24h.high);
    assert.ok(a.horizon_48h.low <= a.horizon_48h.expected);
    assert.ok(a.horizon_48h.expected <= a.horizon_48h.high);
    assert.equal(a.drivers.length <= 3, true);
    assert.ok(a.confidence >= 25 && a.confidence <= 88);
    assert.ok(bundle.details.marketNote.length > 20);
    assert.ok(bundle.details.high7 > 0);
    assert.ok(bundle.details.low7 > 0);
    assert.ok(bundle.details.newsScope === "asset" || bundle.details.newsScope === "market");
  });
});

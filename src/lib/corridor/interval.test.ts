import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KAPPA_24 } from "./config.ts";
import { computeCenters, shrinkMu } from "./center.ts";
import {
  assembleHorizon,
  computeWidthMultiplier,
} from "./interval.ts";

const calm: Parameters<typeof computeWidthMultiplier>[0] = {
  regime: "RANGE_LOWVOL",
  event: false,
  newsShock: 0.05,
  bbWidth: 0.02,
  bbWidthMedian30d: 0.04,
  rsi: 50,
  trend1h: "range",
  trend4h: "range",
  trend1d: "range",
  volRatio: 1,
  stale: false,
};

describe("interval width", () => {
  it("LOWVOL + no news + RSI 50 → w < 1", () => {
    const w = computeWidthMultiplier(calm);
    assert.ok(w < 1, `expected compress, got ${w}`);
    assert.ok(w >= 0.72);
  });

  it("EVENT expands w vs the calm case and the corridor is wider on the same σ", () => {
    const wCalm = computeWidthMultiplier(calm);
    const wEvent = computeWidthMultiplier({
      ...calm,
      event: true,
      regime: "EVENT",
    });
    assert.ok(wEvent > 1, `event w=${wEvent}`);
    assert.ok(wEvent > wCalm);

    const p0 = 100_000;
    const mu = 0;
    const qLo = -0.04;
    const qHi = 0.04;
    const calmBand = assembleHorizon({
      p0,
      mu,
      w: wCalm,
      qLo,
      qHi,
      minWidth: 0.012,
      maxWidth: 0.09,
      targetCoverage: 0.75,
    });
    const eventBand = assembleHorizon({
      p0,
      mu,
      w: wEvent,
      qLo,
      qHi,
      minWidth: 0.012,
      maxWidth: 0.14,
      targetCoverage: 0.75,
    });
    assert.ok(eventBand.width_pct > calmBand.width_pct);
  });

  it("stale=true expands width", () => {
    const fresh = computeWidthMultiplier(calm);
    const stale = computeWidthMultiplier({ ...calm, stale: true });
    assert.ok(stale > fresh);
  });

  it("L < M < H, covers P0, respects min width", () => {
    const p0 = 80_000;
    const band = assembleHorizon({
      p0,
      mu: 0.001,
      w: 1,
      qLo: -0.001,
      qHi: 0.001,
      minWidth: 0.012,
      maxWidth: 0.09,
      targetCoverage: 0.75,
    });
    assert.ok(band.low < band.center && band.center < band.high);
    assert.ok(band.width_pct + 1e-12 >= 0.012);
    assert.ok(band.low < p0 * 0.999 || band.high > p0 * 1.001);
  });
});

describe("center shrinkage", () => {
  it("|μ24| < |μ_raw_24| when Fear & Greed is neutral", () => {
    const c = computeCenters({
      p0: 100_000,
      sTa: 0.8,
      sigma24: 0.04,
      sigma48: 0.055,
      rLast24: 0.01,
      rLast48: 0.015,
      newsShift: 0.2,
      fg: { value: 50, classification: "Neutral" },
    });
    assert.ok(Math.abs(c.mu24) < Math.abs(c.muRaw24));
    assert.equal(shrinkMu(c.muRaw24, KAPPA_24), KAPPA_24 * c.muRaw24);
  });
});

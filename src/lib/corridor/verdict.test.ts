import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVerdict } from "./verdict.ts";
import type { Verdict } from "./types.ts";

type Opts = Parameters<typeof buildVerdict>[0];

const base: Opts = {
  price: 100,
  expected24: 100,
  expected48: 100,
  low24: 97,
  high24: 103,
  muRaw24: 0,
  regime: "RANGE_MIDVOL",
  event: false,
  newsShock: 0,
  confidence: 72,
  rsi: 50,
  trend1h: "range",
  trend4h: "range",
  trend1d: "range",
  tfAligned: false,
  stale: false,
  low30: 90,
  high30: 110,
};

function v(over: Partial<Opts>): Verdict {
  return buildVerdict({ ...base, ...over });
}

describe("verdict", () => {
  it("waits when the day is an event", () => {
    const out = v({ event: true, expected24: 104, muRaw24: 0.03, trend4h: "up" });
    assert.equal(out.side, "wait");
    assert.equal(out.holdHours, 12);
    assert.match(out.reason, /резкое/);
  });

  it("waits when the point forecast is flat and trends conflict", () => {
    const out = v({});
    assert.equal(out.side, "wait");
    assert.equal(out.label, "Без уклона");
  });

  it("buys when expected, raw drift and trends all point up", () => {
    const out = v({
      expected24: 102,
      expected48: 103.5,
      muRaw24: 0.02,
      trend1h: "up",
      trend4h: "up",
      trend1d: "up",
      tfAligned: true,
      rsi: 48,
      low30: 90,
      high30: 120,
    });
    assert.equal(out.side, "buy");
    assert.equal(out.label, "Вверх");
    assert.ok(out.holdHours === 24 || out.holdHours === 48);
    assert.ok(out.target > 100);
    assert.equal(out.invalidation, 97);
  });

  it("sells when expected and trends point down", () => {
    const out = v({
      expected24: 97.5,
      expected48: 96,
      muRaw24: -0.02,
      trend1h: "down",
      trend4h: "down",
      trend1d: "down",
      tfAligned: true,
      rsi: 52,
      low30: 80,
      high30: 110,
    });
    assert.equal(out.side, "sell");
    assert.equal(out.label, "Вниз");
    assert.ok(out.target < 100);
    assert.equal(out.invalidation, 103);
  });

  it("holds 48h when the 48h expected continues farther the same way", () => {
    const out = v({
      expected24: 101.2,
      expected48: 103.4,
      muRaw24: 0.015,
      trend1h: "up",
      trend4h: "up",
      trend1d: "up",
      tfAligned: true,
      rsi: 45,
      regime: "TREND_UP_LOWVOL",
      low30: 88,
      high30: 115,
    });
    assert.equal(out.side, "buy");
    assert.equal(out.holdHours, 48);
    assert.equal(out.target, 103.4);
  });

  it("does not stretch to 48h in high vol", () => {
    const out = v({
      expected24: 101.2,
      expected48: 103.4,
      muRaw24: 0.015,
      trend1h: "up",
      trend4h: "up",
      trend1d: "up",
      tfAligned: true,
      rsi: 45,
      regime: "TREND_UP_HIGHVOL",
      low30: 88,
      high30: 115,
    });
    assert.equal(out.side, "buy");
    assert.equal(out.holdHours, 24);
  });
});

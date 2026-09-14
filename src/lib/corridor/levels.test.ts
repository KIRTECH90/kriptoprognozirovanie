import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findLevels } from "./levels.ts";
import type { Candle } from "./types.ts";

function candle(t: number, low: number, high: number, close: number): Candle {
  return { openTime: t, open: close, high, low, close, volume: 10 };
}

function bounce(n: number, lo: number, hi: number, stepMs: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const up = i % 8 < 4;
    const close = up ? hi - (i % 4) * 0.4 : lo + (i % 4) * 0.4;
    const high = up ? hi : close + 0.3;
    const low = up ? close - 0.3 : lo;
    out.push(candle(i * stepMs, low, high, close));
  }
  return out;
}

describe("levels", () => {
  it("finds support below and resistance above the last price", () => {
    const h1 = bounce(200, 90, 110, 3600_000);
    const d1 = bounce(40, 88, 112, 86400_000);
    const price = h1[h1.length - 1]!.close;
    const out = findLevels({
      h1,
      d1,
      price,
      high24: 110,
      low24: 90,
      high7: 110,
      low7: 90,
      high30: 112,
      low30: 88,
    });
    const supports = out.levels.filter((l) => l.side === "support");
    const resists = out.levels.filter((l) => l.side === "resistance");
    assert.ok(supports.length >= 1);
    assert.ok(resists.length >= 1);
    assert.ok(supports.every((l) => l.price < price));
    assert.ok(resists.every((l) => l.price > price));
    assert.match(out.note, /поддержк/i);
    assert.match(out.note, /сопротивлени/i);
  });

  it("clusters nearby 24h and 7d highs into one resistance", () => {
    const h1 = bounce(80, 99, 101, 3600_000);
    const price = 100;
    const out = findLevels({
      h1,
      d1: bounce(20, 98, 102, 86400_000),
      price,
      high24: 101.1,
      low24: 99.0,
      high7: 101.2,
      low7: 98.9,
      high30: 104,
      low30: 96,
    });
    const resists = out.levels.filter((l) => l.side === "resistance");
    assert.ok(resists.length >= 1);
    const near = resists[0]!;
    assert.ok(near.price > 100.5 && near.price < 102);
  });
});

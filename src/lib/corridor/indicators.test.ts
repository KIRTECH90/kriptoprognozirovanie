import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { atrWilder, ema, rsiWilder } from "./indicators.ts";

describe("indicators", () => {
  it("EMA matches the spec seed EMA_1 = P_1", () => {
    const p = [10, 11, 12];
    const n = 2;
    const alpha = 2 / (n + 1);
    const got = ema(p, n);
    assert.equal(got[0], 10);
    assert.ok(Math.abs(got[1]! - (alpha * 11 + (1 - alpha) * 10)) < 1e-12);
    const e2 = alpha * 11 + (1 - alpha) * 10;
    assert.ok(Math.abs(got[2]! - (alpha * 12 + (1 - alpha) * e2)) < 1e-12);
  });

  it("RSI Wilder on a short series matches hand calculation", () => {
    const p = [10, 12, 11, 13, 12];
    const n = 3;
    const got = rsiWilder(p, n);
    // first RSI at index 3 (after 3 deltas)
    assert.ok(Math.abs(got[3]! - 80) < 1e-10);
    // next: avgGain=8/9, avgLoss=5/9, RS=1.6, RSI=61.538461...
    assert.ok(Math.abs(got[4]! - (100 - 100 / 2.6)) < 1e-10);
  });

  it("ATR Wilder uses TR then Wilder smooth", () => {
    const c = [10, 12, 11, 13, 12];
    const h = c.map((x) => x);
    const l = c.map((x) => x);
    const n = 3;
    const got = atrWilder(h, l, c, n);
    // TR: [0, 2, 1, 2, 1]  (first = H-L = 0)
    // first ATR at index 2 = mean(0,2,1)=1
    assert.ok(Math.abs(got[2]! - 1) < 1e-12);
    // next = (1*2 + 2)/3 = 4/3
    assert.ok(Math.abs(got[3]! - 4 / 3) < 1e-12);
  });
});

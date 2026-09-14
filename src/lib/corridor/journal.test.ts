import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { walkForwardCalibrate } from "./calibrate.ts";
import { journalFromWalk, liveJournalFromRows } from "./journal.ts";
import type { Candle } from "./types.ts";

function bounce(n: number, lo: number, hi: number, stepMs: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const up = i % 8 < 4;
    const close = up ? hi - (i % 4) * 0.4 : lo + (i % 4) * 0.4;
    const high = up ? hi : close + 0.3;
    const low = up ? close - 0.3 : lo;
    out.push({
      openTime: Date.UTC(2025, 0, 1) + i * stepMs,
      open: close,
      high,
      low,
      close,
      volume: 10,
    });
  }
  return out;
}

describe("journal", () => {
  it("records 24h facts from walk-forward", () => {
    const h1 = bounce(400, 90, 110, 3600_000);
    const h4 = bounce(140, 90, 110, 4 * 3600_000);
    const d1 = bounce(80, 88, 112, 86400_000);
    const wf = walkForwardCalibrate({
      h1,
      h4,
      d1,
      symbol: "BTCUSDT",
      stepHours: 24,
    });
    assert.ok(wf.n24 >= 4);
    assert.ok(wf.rows.length >= 4);
    assert.ok(wf.rows.every((r) => r.fact24 != null && r.hit24 != null));
    const j = journalFromWalk("BTCUSDT", wf);
    assert.equal(j.symbol, "BTCUSDT");
    assert.ok(j.rows.length >= 4);
    assert.ok(j.nDays24 >= 4);
    assert.equal(j.target24, 0.75);
    assert.equal(journalFromWalk("BTCUSDT", { ...wf, hours: 500 }).empiricalReady, false);
    assert.equal(journalFromWalk("BTCUSDT", { ...wf, hours: 2000 }).empiricalReady, true);
  });

  it("live journal starts empty and counts pending separately", () => {
    const empty = liveJournalFromRows("BTCUSDT", []);
    assert.equal(empty.nIssued, 0);
    assert.equal(empty.coverage24, null);
    const live = liveJournalFromRows("ETHUSDT", [
      {
        ts: Date.now(),
        price: 3000,
        low24: 2900,
        high24: 3100,
        center24: 3000,
        width24: 0.06,
        fact24: null,
        hit24: null,
        pending24: true,
        low48: 2800,
        high48: 3200,
        fact48: null,
        hit48: null,
        pending48: true,
      },
    ]);
    assert.equal(live.nIssued, 1);
    assert.equal(live.nPending24, 1);
    assert.equal(live.nSettled24, 0);
    assert.equal(live.coverage24, null);
  });
});

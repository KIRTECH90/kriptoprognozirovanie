import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMarketNote, pctFromLog, rangePos } from "./market-brief.ts";

describe("market-brief", () => {
  it("places price at the top of the month near the high", () => {
    const note = buildMarketNote({
      name: "Bitcoin",
      price: 99,
      r24: Math.log(1.05),
      r7: Math.log(1.12),
      r30: Math.log(1.22),
      low24: 90,
      high24: 100,
      low30: 70,
      high30: 100,
      fgValue: 72,
    });
    assert.match(note, /Bitcoin/);
    assert.match(note, /рост/);
    assert.match(note, /верхн/);
    assert.match(note, /жадность/);
  });

  it("places price at the bottom after a quiet day", () => {
    const note = buildMarketNote({
      name: "Ethereum",
      price: 71,
      r24: Math.log(0.998),
      r7: Math.log(0.92),
      r30: Math.log(0.82),
      low24: 70.5,
      high24: 71.4,
      low30: 70,
      high30: 95,
      fgValue: 30,
    });
    assert.match(note, /тихий/);
    assert.match(note, /узкий/);
    assert.match(note, /нижн/);
    assert.match(note, /страх/);
  });

  it("maps log returns and range position", () => {
    assert.ok(Math.abs(pctFromLog(Math.log(1.1)) - 0.1) < 1e-9);
    assert.equal(rangePos(75, 50, 100), 0.5);
    assert.equal(rangePos(10, 50, 100), 0);
    assert.equal(rangePos(200, 50, 100), 1);
  });
});

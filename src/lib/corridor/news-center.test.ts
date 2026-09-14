import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newsShiftForCenter } from "./news-center.ts";

describe("news center shift", () => {
  it("only lets hard news move the center", () => {
    assert.equal(newsShiftForCenter("NOISE", 0.8), 0);
    assert.equal(newsShiftForCenter("RUMOR", 0.8), 0);
    assert.equal(newsShiftForCenter("MACRO", 0.8), 0);
    assert.equal(newsShiftForCenter("HACK", 0.8), 0.8);
    assert.equal(newsShiftForCenter("REGULATION", -0.5), -0.5);
    assert.equal(newsShiftForCenter("LISTING", 0.4), 0.4);
  });

  it("lets an ETF headline move the center even if typed as noise", () => {
    assert.equal(newsShiftForCenter("NOISE", 0.6, "Spot bitcoin ETF inflows hit a record"), 0.6);
    assert.equal(newsShiftForCenter("NOISE", 0.6, "The securities offering starts Monday"), 0);
  });
});

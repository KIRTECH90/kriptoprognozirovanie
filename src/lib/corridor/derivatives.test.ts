import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { derivativesDriver, derivativesTilt } from "./derivatives.ts";

describe("derivatives tilt", () => {
  it("does nothing without a snap", () => {
    const t = derivativesTilt(null);
    assert.equal(t.lo, 1);
    assert.equal(t.hi, 1);
    assert.equal(t.w, 1);
    assert.equal(derivativesDriver(null), null);
  });

  it("widens the high side when funding is crowded-long", () => {
    const t = derivativesTilt({ funding: 0.0008, basis: 0 });
    assert.ok(t.hi > t.lo, `hi=${t.hi} lo=${t.lo}`);
    assert.ok(t.hi > 1);
    assert.ok(t.w > 1);
    assert.ok(derivativesDriver({ funding: 0.0008, basis: 0 }));
  });

  it("widens the low side when funding is crowded-short", () => {
    const t = derivativesTilt({ funding: -0.0006, basis: 0 });
    assert.ok(t.lo > t.hi);
    assert.ok(t.lo > 1);
  });

  it("does not fatten a quiet book", () => {
    const t = derivativesTilt({ funding: 0.00005, basis: 0.0004 });
    assert.equal(t.lo, 1);
    assert.equal(t.hi, 1);
    assert.equal(t.w, 1);
    assert.equal(derivativesDriver({ funding: 0.00005, basis: 0.0004 }), null);
  });
});

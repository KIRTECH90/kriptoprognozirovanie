import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAsset, matchesKeywords, widthCapMult } from "./markets.ts";

describe("market keywords", () => {
  it("does not treat telegram as TON news", () => {
    const keys = getAsset("TON").keywords;
    assert.equal(matchesKeywords("Telegram launches mini apps for traders", keys), false);
    assert.equal(matchesKeywords("TON dumped after unlock", keys), true);
    assert.equal(matchesKeywords("Toncoin listing on a new venue", keys), true);
  });

  it("does not treat sold as SOL", () => {
    const keys = getAsset("SOL").keywords;
    assert.equal(matchesKeywords("The team sold another tranche", keys), false);
    assert.equal(matchesKeywords("Solana validators halt", keys), true);
  });

  it("caps meme width instead of inventing a model", () => {
    assert.equal(widthCapMult("BTC"), 1);
    assert.ok(widthCapMult("PEPE") > 1);
    assert.ok(widthCapMult("SHIB") > 1);
  });
});

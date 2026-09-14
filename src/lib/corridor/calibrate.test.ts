import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newsAsOf } from "./calibrate.ts";
import { fitHorizon } from "./calibrate.ts";
import { scoreNews } from "./news-score.ts";
import type { NewsItem } from "./types.ts";

describe("calibration news timestamp guard", () => {
  it("drops news published after t so walk-forward cannot peek", () => {
    const t = Date.UTC(2026, 5, 1, 12);
    const items: NewsItem[] = [
      {
        title: "ETF approved",
        source: "x",
        url: "https://a",
        publishedAt: t - 3600_000,
        coins: ["BTC"],
        rawText: "ETF approved",
      },
      {
        title: "Huge hack drains exchange",
        source: "x",
        url: "https://b",
        publishedAt: t + 3600_000,
        coins: ["BTC"],
        rawText: "Huge hack drains exchange",
      },
    ];
    const asOf = newsAsOf(items, t);
    assert.equal(asOf.length, 1);
    assert.equal(asOf[0]!.title, "ETF approved");

    const leaked = scoreNews(items, t + 2 * 3600_000);
    const honest = scoreNews(asOf, t);
    assert.ok(leaked.newsShock > honest.newsShock);
  });
});

describe("asymmetric calibration", () => {
  it("widens the low side when misses are mostly below", () => {
    const rows = [];
    for (let i = 0; i < 30; i++) {
      rows.push({
        price: 100,
        center: 100,
        low: 97,
        high: 103,
        fact: i < 12 ? 96.4 : 100,
        width: 0.06,
      });
    }
    const fit = fitHorizon(rows, 0.75, 1.15, 0.065, 0.12);
    assert.ok(fit.lo > fit.hi, `lo=${fit.lo} hi=${fit.hi}`);
  });
});

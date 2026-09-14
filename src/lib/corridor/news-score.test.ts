import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupNews, scoreNews } from "./news-score.ts";
import type { NewsItem } from "./types.ts";

function item(title: string, extra: Partial<NewsItem> = {}): NewsItem {
  return {
    title,
    source: "t",
    url: extra.url ?? title,
    publishedAt: extra.publishedAt ?? Date.now() - 60_000,
    coins: ["BTC"],
    rawText: extra.rawText ?? title,
    ...extra,
  };
}

describe("news scoring", () => {
  it("dedups two almost identical headlines into one shock", () => {
    const now = Date.now();
    const items = [
      item("Bitcoin ETF approved by SEC"),
      item("Bitcoin ETF approved by SEC!!!", { url: "https://other.example/1" }),
    ];
    const unique = dedupNews(items);
    assert.equal(unique.length, 1);
    const agg = scoreNews(items, now);
    assert.equal(agg.items.length, 1);
    const doubled = scoreNews([items[0]!], now);
    assert.ok(Math.abs(agg.newsShock - doubled.newsShock) < 1e-9);
  });
});

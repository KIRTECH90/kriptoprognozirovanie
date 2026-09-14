import { FETCH_TIMEOUT_MS } from "@/lib/corridor/config.ts";
import type { NewsItem } from "@/lib/corridor/types.ts";
import { ASSETS } from "@/lib/markets.ts";

const RSS_FEEDS = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
];

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/'/g, "'");
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeXml(m[1]!.trim()) : "";
}

function coinsOf(text: string): string[] {
  const hay = text.toLowerCase();
  return ASSETS.filter((a) => a.keywords.some((k) => hay.includes(k))).map((a) => a.id);
}

function parseRss(xml: string, source: string): NewsItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const out: NewsItem[] = [];
  for (const m of items) {
    const block = m[1]!;
    const title = tag(block, "title");
    if (!title) continue;
    const url = tag(block, "link") || tag(block, "guid");
    const pub = tag(block, "pubDate") || tag(block, "published");
    const publishedAt = pub ? Date.parse(pub) : Date.now();
    const rawText = tag(block, "description") || title;
    out.push({
      title,
      source,
      url,
      publishedAt: Number.isFinite(publishedAt) ? publishedAt : Date.now(),
      coins: coinsOf(`${title} ${rawText}`),
      rawText: rawText.replace(/<[^>]+>/g, " ").slice(0, 500),
    });
  }
  return out;
}

async function fetchText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "Corridor/1.0",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchCryptocurrencyCv(): Promise<NewsItem[] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://cryptocurrency.cv/api/news", {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Corridor/1.0" },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const rows = Array.isArray(json)
      ? json
      : json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)
        ? (json as { data: unknown[] }).data
        : [];
    const out: NewsItem[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const title = String(r.title ?? r.headline ?? "");
      if (!title) continue;
      const publishedAt = Date.parse(String(r.published_at ?? r.publishedAt ?? r.date ?? "")) || Date.now();
      out.push({
        title,
        source: String(r.source ?? r.publisher ?? "cryptocurrency.cv"),
        url: String(r.url ?? r.link ?? ""),
        publishedAt,
        coins: Array.isArray(r.coins) ? r.coins.map(String) : ["BTC"],
        rawText: String(r.body ?? r.text ?? r.description ?? title),
      });
    }
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchNews(): Promise<{ items: NewsItem[]; staleNews: boolean }> {
  const cv = await fetchCryptocurrencyCv();
  if (cv && cv.length > 0) return { items: cv, staleNews: false };

  const batches = await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      const xml = await fetchText(feed.url);
      if (!xml) return [] as NewsItem[];
      return parseRss(xml, feed.source);
    }),
  );
  const items = batches.flat();
  if (items.length === 0) return { items: [], staleNews: true };
  return { items, staleNews: false };
}

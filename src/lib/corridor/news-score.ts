import {
  NEWS_CALM_SHOCK,
  NEWS_DEDUP_THRESHOLD,
  NEWS_EVENT_THRESHOLD,
  NEWS_MAX_IN_SUM,
  NEWS_NOVELTY_HOURS,
  NEWS_SHIFT_CLIP,
  NEWS_SHOCK_CLIP,
  NEWS_WINDOW_HOURS,
  NOISE_SEVERITY_MULT,
  RUMOR_SEVERITY_MULT,
} from "./config.ts";
import { clip } from "./math.ts";
import type { NewsAggregate, NewsItem, NewsType, ScoredNews } from "./types.ts";

const TYPE_KEYWORDS: [NewsType, string[]][] = [
  ["HACK", ["hack", "exploit", "breach", "drained", "взлом", "хак", "эксплойт"]],
  [
    "REGULATION",
    ["sec", "etf rejected", "запрет", "регулирование", "иск"],
  ],
  ["MACRO", ["cpi", "fomc", "fed", "rates", "nfp", "inflation", "ставка", "инфляц"]],
  ["LISTING", ["listing", "listed", "etf approved", "approved", "листинг"]],
  ["ADOPTION", ["reserve", "treasury", "buys bitcoin", "adoption"]],
  ["RUMOR", ["reportedly", "sources say", "unconfirmed", "слух", "по слухам"]],
];

const NEG_MARKERS = [
  "hack",
  "exploit",
  "breach",
  "drained",
  "ban",
  "banned",
  "rejected",
  "crash",
  "liquidation cascade",
  "взлом",
  "запрет",
  "отказ",
];
const POS_MARKERS = [
  "approved",
  "listing",
  "listed",
  "buys",
  "inflows",
  "adoption",
  "одобр",
  "листинг",
];

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(title: string): string[] {
  return normalizeTitle(title)
    .split(" ")
    .filter((w) => w.length > 1);
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function cosineTokens(a: string[], b: string[]): number {
  const counts = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const A = counts(a);
  const B = counts(b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [, v] of A) na += v * v;
  for (const [, v] of B) nb += v * v;
  for (const [k, v] of A) dot += v * (B.get(k) ?? 0);
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function isDuplicate(a: NewsItem, b: NewsItem): boolean {
  if (a.url && b.url && a.url === b.url) return true;
  const ta = tokenize(a.title);
  const tb = tokenize(b.title);
  const sim = Math.max(jaccard(ta, tb), cosineTokens(ta, tb));
  return sim >= NEWS_DEDUP_THRESHOLD;
}

export function dedupNews(items: NewsItem[]): NewsItem[] {
  const out: NewsItem[] = [];
  for (const item of items) {
    if (out.some((x) => isDuplicate(x, item))) continue;
    out.push(item);
  }
  return out;
}

function hasKeyword(text: string, kw: string): boolean {
  const t = text.toLowerCase();
  const k = kw.toLowerCase().trim();
  if (!k) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(k)}($|[^\\p{L}\\p{N}])`, "iu");
  return re.test(t);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function classifyType(title: string, raw: string): NewsType {
  const hay = `${title} ${raw}`;
  for (const [type, kws] of TYPE_KEYWORDS) {
    if (kws.some((k) => hasKeyword(hay, k))) return type;
  }
  return "NOISE";
}

export function polarityOf(title: string, raw: string, type: NewsType): -1 | 0 | 1 {
  const hay = `${title} ${raw}`;
  if (NEG_MARKERS.some((k) => hasKeyword(hay, k))) return -1;
  if (type === "HACK") return -1;
  if (POS_MARKERS.some((k) => hasKeyword(hay, k))) return 1;
  return 0;
}

export function severityOf(title: string, raw: string, type: NewsType): number {
  const hay = `${title} ${raw}`.toLowerCase();
  let sev = 0.15;
  if (
    /взлом крупн|major (exchange )?hack|drained|spot ban|etf rejected|запрет спота/.test(
      hay,
    )
  ) {
    sev = 1;
  } else if (/fomc|cpi|nfp|сюрприз|surprise/.test(hay)) {
    sev = 0.85;
  } else if (
    /listing|listed|etf approved|inflow|reserve|treasury|крупный листинг|регулир/.test(
      hay,
    )
  ) {
    sev = 0.6;
  } else if (/analyst|считает|sources say|reportedly|слух/.test(hay)) {
    sev = 0.35;
  } else if (type === "NOISE") {
    sev = 0.15;
  } else {
    sev = 0.35;
  }
  if (type === "RUMOR") sev *= RUMOR_SEVERITY_MULT;
  if (type === "NOISE") sev *= NOISE_SEVERITY_MULT;
  return clip(sev, 0, 1);
}

function noveltyOf(item: NewsItem, all: NewsItem[], now: number): number {
  const hour = 3600_000;
  const similarRecent = all.filter((other) => {
    if (other === item) return false;
    if (other.publishedAt >= item.publishedAt) return false;
    const dt = item.publishedAt - other.publishedAt;
    if (dt > NEWS_NOVELTY_HOURS * hour) return false;
    return isDuplicate(item, other) || jaccard(tokenize(item.title), tokenize(other.title)) >= 0.5;
  });
  const newestDupAge = similarRecent.reduce((min, x) => {
    const age = now - x.publishedAt;
    return Math.min(min, age);
  }, Infinity);
  if (newestDupAge <= hour) return 0.1;
  if (similarRecent.length > 0) return 0.4;
  return 1;
}

export function scoreNews(items: NewsItem[], now: number): NewsAggregate {
  const unique = dedupNews(items);
  const windowMs = NEWS_WINDOW_HOURS * 3600_000;
  const scored: ScoredNews[] = unique.map((item) => {
    const type = classifyType(item.title, item.rawText);
    const polarity = polarityOf(item.title, item.rawText, type);
    const severity = severityOf(item.title, item.rawText, type);
    const novelty = noveltyOf(item, unique, now);
    const shock = polarity * severity * novelty;
    return { ...item, type, polarity, severity, novelty, shock };
  });

  const inWindow = scored.filter((x) => now - x.publishedAt <= windowMs && x.publishedAt <= now);
  inWindow.sort((a, b) => Math.abs(b.shock) - Math.abs(a.shock));
  const used = inWindow.slice(0, NEWS_MAX_IN_SUM);

  const newsShift = clip(
    used.reduce((s, x) => s + x.shock, 0),
    -NEWS_SHIFT_CLIP,
    NEWS_SHIFT_CLIP,
  );
  const maxAbs = used.reduce((m, x) => Math.max(m, Math.abs(x.shock)), 0);
  const sumAbs = used.reduce((s, x) => s + Math.abs(x.shock), 0);
  const newsShock = clip(maxAbs + 0.25 * sumAbs, 0, NEWS_SHOCK_CLIP);

  return { items: used, newsShift, newsShock, staleNews: false };
}

export const NEWS_THRESHOLDS = { NEWS_EVENT_THRESHOLD, NEWS_CALM_SHOCK };

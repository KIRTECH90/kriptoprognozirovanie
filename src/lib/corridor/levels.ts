import { formatPct, formatPrice, priceDecimals } from "../format.ts";
import { atrWilder, closesOf, highsOf, lowsOf } from "./indicators.ts";
import { lastFinite, roundTo } from "./math.ts";
import type { Candle, LevelSide, LevelSource, LevelStrength, PriceLevel } from "./types.ts";

type Raw = {
  price: number;
  source: LevelSource;
  touches: number;
};

const SOURCE_RANK: Record<LevelSource, number> = {
  month: 4,
  week: 3,
  day: 2,
  swing: 1,
};

function swings(candles: Candle[], left: number, right: number): Raw[] {
  const out: Raw[] = [];
  if (candles.length < left + right + 1) return out;
  const last = candles.length - 1 - right;
  for (let i = left; i <= last; i++) {
    const h = candles[i]!.high;
    const l = candles[i]!.low;
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j]!.high > h) isHigh = false;
      if (candles[j]!.low < l) isLow = false;
    }
    if (isHigh) out.push({ price: h, source: "swing", touches: 1 });
    if (isLow) out.push({ price: l, source: "swing", touches: 1 });
  }
  return out;
}

function dailyPivots(d1: Candle[]): Raw[] {
  if (d1.length < 2) return [];
  const prev = d1[d1.length - 2]!;
  const pp = (prev.high + prev.low + prev.close) / 3;
  const r1 = 2 * pp - prev.low;
  const s1 = 2 * pp - prev.high;
  const r2 = pp + (prev.high - prev.low);
  const s2 = pp - (prev.high - prev.low);
  return [
    { price: r2, source: "swing" as const, touches: 1 },
    { price: r1, source: "swing" as const, touches: 1 },
    { price: s1, source: "swing" as const, touches: 1 },
    { price: s2, source: "swing" as const, touches: 1 },
  ].filter((x) => Number.isFinite(x.price) && x.price > 0);
}

function cluster(raw: Raw[], tol: number): Raw[] {
  if (!raw.length) return [];
  const sorted = raw
    .filter((x) => Number.isFinite(x.price) && x.price > 0)
    .sort((a, b) => a.price - b.price);
  const out: Raw[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(p.price - last.price) <= tol) {
      const w = last.touches + p.touches;
      last.price = (last.price * last.touches + p.price * p.touches) / w;
      last.touches = w;
      if (SOURCE_RANK[p.source] > SOURCE_RANK[last.source]) last.source = p.source;
    } else {
      out.push({ ...p });
    }
  }
  return out;
}

function labelOf(source: LevelSource, side: LevelSide): string {
  if (source === "day") return side === "support" ? "дно суток" : "верх суток";
  if (source === "week") return side === "support" ? "дно недели" : "верх недели";
  if (source === "month") return side === "support" ? "дно месяца" : "верх месяца";
  return side === "support" ? "поддержка" : "сопротивление";
}

function strengthOf(src: LevelSource, touches: number): LevelStrength {
  if (src === "month" || touches >= 4) return "strong";
  if (src === "week" || src === "day" || touches >= 2) return "medium";
  return "weak";
}

export function buildLevelsNote(price: number, levels: PriceLevel[]): string {
  const dec = priceDecimals(price);
  const nearS = levels.find((l) => l.side === "support" && l.role === "near") ?? levels.find((l) => l.side === "support");
  const nearR = levels.find((l) => l.side === "resistance" && l.role === "near") ?? levels.find((l) => l.side === "resistance");
  const nextS = levels.find((l) => l.side === "support" && l.role === "next");
  const nextR = levels.find((l) => l.side === "resistance" && l.role === "next");
  if (!nearS && !nearR) return "Чётких уровней рядом сейчас нет.";
  const bits: string[] = [];
  if (nearS) {
    bits.push(`Ближняя поддержка ${formatPrice(nearS.price, dec)} — ${nearS.label} (${formatPct(nearS.distPct)}).`);
  }
  if (nearR) {
    bits.push(`Ближнее сопротивление ${formatPrice(nearR.price, dec)} — ${nearR.label} (${formatPct(nearR.distPct)}).`);
  }
  bits.push("Это не два коридора: ближний — где цена чаще отбивается сейчас.");
  if (nextS || nextR) {
    bits.push("Дальний сработает, только если ближний пробьют.");
  }
  return bits.join(" ");
}

export function findLevels(opts: {
  h1: Candle[];
  d1: Candle[];
  price: number;
  high24: number;
  low24: number;
  high7: number;
  low7: number;
  high30: number;
  low30: number;
}): { levels: PriceLevel[]; note: string } {
  const p0 = opts.price;
  if (!(p0 > 0)) return { levels: [], note: "Чётких уровней рядом сейчас нет." };

  const atr = lastFinite(atrWilder(highsOf(opts.h1), lowsOf(opts.h1), closesOf(opts.h1)));
  const tol = Math.max(p0 * 0.0035, Number.isFinite(atr) ? atr * 0.45 : p0 * 0.004);

  const raw: Raw[] = [
    { price: opts.high24, source: "day", touches: 2 },
    { price: opts.low24, source: "day", touches: 2 },
    { price: opts.high7, source: "week", touches: 2 },
    { price: opts.low7, source: "week", touches: 2 },
    { price: opts.high30, source: "month", touches: 3 },
    { price: opts.low30, source: "month", touches: 3 },
    ...swings(opts.h1.slice(-24 * 12), 2, 2),
    ...swings(opts.d1.slice(-60), 2, 2),
    ...dailyPivots(opts.d1),
  ];

  const grouped = cluster(raw, tol);
  const dead = p0 * 0.0022;
  const supports = grouped
    .filter((g) => g.price < p0 - dead)
    .sort((a, b) => b.price - a.price);
  const resists = grouped
    .filter((g) => g.price > p0 + dead)
    .sort((a, b) => a.price - b.price);

  const pick = (list: Raw[], side: LevelSide): PriceLevel[] =>
    list.slice(0, 2).map((g, i) => {
      const distPct = (g.price - p0) / p0;
      return {
        price: g.price,
        side,
        strength: strengthOf(g.source, g.touches),
        source: g.source,
        role: i === 0 ? "near" : "next",
        label: labelOf(g.source, side),
        distPct,
      };
    });

  const levels = [...pick(resists, "resistance"), ...pick(supports, "support")];
  return { levels, note: buildLevelsNote(p0, levels) };
}

export function roundLevels(levels: PriceLevel[], decimals: number): PriceLevel[] {
  return levels.map((l) => ({
    ...l,
    price: roundTo(l.price, decimals),
  }));
}

import { formatPct, formatPrice, priceDecimals } from "../format.ts";
import { rangePos } from "./market-brief.ts";
import { clip, roundTo } from "./math.ts";
import type {
  HorizonBand,
  Regime,
  TradeSide,
  TrendDir,
  Verdict,
  VerdictStrength,
} from "./types.ts";

function trendPts(t: TrendDir): number {
  if (t === "up") return 1;
  if (t === "down") return -1;
  return 0;
}

function strengthOf(score: number, confidence: number, aligned: boolean): VerdictStrength {
  const a = Math.abs(score);
  if (a >= 1.7 && confidence >= 70 && aligned) return "strong";
  if (a >= 1.0 || (aligned && a >= 0.75)) return "medium";
  return "weak";
}

function strengthLabel(s: VerdictStrength): string {
  if (s === "strong") return "уверенно";
  if (s === "medium") return "скорее да";
  return "слабо";
}

export function buildVerdict(opts: {
  price: number;
  expected24: number;
  expected48: number;
  low24: number;
  high24: number;
  muRaw24: number;
  regime: Regime;
  event: boolean;
  newsShock: number;
  confidence: number;
  rsi: number;
  trend1h: TrendDir;
  trend4h: TrendDir;
  trend1d: TrendDir;
  tfAligned: boolean;
  stale: boolean;
  low30: number;
  high30: number;
}): Verdict {
  const p0 = opts.price;
  const dec = priceDecimals(p0);
  const move24 = p0 > 0 ? (opts.expected24 - p0) / p0 : 0;
  const move48 = p0 > 0 ? (opts.expected48 - p0) / p0 : 0;
  const blend = move24;

  let score = blend / 0.008;
  score += 0.35 * trendPts(opts.trend1h);
  score += 0.5 * trendPts(opts.trend4h);
  score += 0.45 * trendPts(opts.trend1d);
  if (opts.tfAligned) {
    const dir = Math.sign(score) || trendPts(opts.trend4h);
    score += 0.35 * dir;
  }
  const pos = rangePos(p0, opts.low30, opts.high30);
  if (pos <= 0.22) score += 0.35;
  if (pos >= 0.78) score -= 0.35;
  if (opts.rsi >= 72) score -= 0.4;
  if (opts.rsi <= 28) score += 0.4;
  score = clip(score, -4, 4);

  const waitEvent = opts.event || opts.newsShock >= 0.55;
  const waitStale = opts.stale || opts.confidence < 48;
  const waitTop = score > 0 && opts.rsi >= 75 && pos >= 0.8;
  const waitFloor = score < 0 && opts.rsi <= 25 && pos <= 0.2;
  const waitFlat = Math.abs(score) < 0.55;

  if (waitEvent || waitStale || waitTop || waitFloor || waitFlat) {
    let reason: string;
    let holdHours = 24;
    if (waitEvent) {
      holdHours = 12;
      reason = opts.event
        ? "Сейчас резкое движение. Входить рано — подождите, пока ход успокоится."
        : "Свежие сильные новости ещё доигрываются. Сейчас лучше не входить.";
    } else if (waitTop) {
      holdHours = 12;
      reason = "Цена у верха месяца и рынок перегрет. Покупать здесь поздно — подождите откат.";
    } else if (waitFloor) {
      holdHours = 12;
      reason = "Цена уже у низа месяца. Продавать падение сейчас — слабая идея.";
    } else if (waitStale) {
      holdHours = 12;
      reason = "Данных или уверенности не хватает. Подождать следующую оценку, не открывать сейчас.";
    } else {
      reason = "Ориентир почти как сейчас — ясной стороны нет. Лучше подождать.";
    }
    return {
      side: "wait",
      strength: "weak",
      label: "Подождать",
      reason,
      holdHours,
      target: roundTo(opts.expected24, dec),
      invalidation: roundTo(p0, dec),
    };
  }

  const side: TradeSide = score > 0 ? "buy" : "sell";
  const strength = strengthOf(score, opts.confidence, opts.tfAligned);
  const highVol = opts.regime.includes("HIGHVOL");
  const sameDir = move24 * move48 > 0;
  const farther48 =
    sameDir && Math.abs(move48) > Math.abs(move24) * 1.18 && Math.abs(move48) > 0.004;
  const holdHours = !highVol && farther48 ? 48 : 24;
  const targetRaw = holdHours === 48 ? opts.expected48 : opts.expected24;
  const target = roundTo(targetRaw, dec);
  const invalidation = roundTo(side === "buy" ? opts.low24 : opts.high24, dec);
  const px = formatPrice(target, dec);
  const move = p0 > 0 ? (target - p0) / p0 : 0;
  const how = strengthLabel(strength);
  const align = opts.tfAligned
    ? side === "buy"
      ? "Часы, 4 часа и день смотрят вверх."
      : "Часы, 4 часа и день смотрят вниз."
    : side === "buy"
      ? "Модель клонит вверх."
      : "Модель клонит вниз.";

  const reason =
    side === "buy"
      ? `${align} Покупать сейчас (${how}), фиксировать около ${px} (${formatPct(move)}) через ${holdHours} ч.`
      : `${align} Продавать сейчас (${how}), фиксировать около ${px} (${formatPct(move)}) через ${holdHours} ч.`;

  return {
    side,
    strength,
    label: side === "buy" ? "Покупать" : "Продавать",
    reason,
    holdHours,
    target,
    invalidation,
  };
}

export function verdictTone(side: TradeSide): "ok" | "event" | "warn" {
  if (side === "buy") return "ok";
  if (side === "sell") return "event";
  return "warn";
}

export function strengthPhrase(s: VerdictStrength, side: TradeSide): string {
  if (side === "wait") return "нет стороны";
  return strengthLabel(s);
}

export function targetInsideBand(v: Verdict, band: HorizonBand): boolean {
  if (v.side === "wait") return true;
  return v.target >= band.low && v.target <= band.high;
}

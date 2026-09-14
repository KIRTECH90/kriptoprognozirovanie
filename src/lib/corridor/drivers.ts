import {
  CONF_BASE,
  CONF_EVENT,
  CONF_HIGHVOL,
  CONF_LOWVOL,
  CONF_MAX,
  CONF_MIN,
  CONF_NEWS,
  CONF_STALE,
  CONF_TF_ALIGN,
} from "./config.ts";
import { clip } from "./math.ts";
import { formatPct, formatPctAbs, formatPrice, fearGreedPhrase, priceDecimals } from "../format.ts";
import type { Regime, TrendDir } from "./types.ts";

export function confidenceOf(opts: {
  regime: Regime;
  newsShock: number;
  tfAligned: boolean;
  stale: boolean;
}): number {
  let conf = CONF_BASE;
  if (opts.regime === "EVENT") conf -= CONF_EVENT;
  if (opts.regime.includes("HIGHVOL")) conf -= CONF_HIGHVOL;
  if (opts.newsShock >= 0.55) conf -= CONF_NEWS;
  if (opts.regime.includes("LOWVOL") && opts.regime !== "EVENT") conf += CONF_LOWVOL;
  if (opts.tfAligned) conf += CONF_TF_ALIGN;
  if (opts.stale) conf -= CONF_STALE;
  return Math.round(clip(conf, CONF_MIN, CONF_MAX));
}

export function regimeLabel(regime: Regime): string {
  if (regime === "EVENT") return "Резкое движение";
  const vol = regime.includes("LOWVOL")
    ? "спокойный рынок"
    : regime.includes("HIGHVOL")
      ? "высокая волатильность"
      : "обычная волатильность";
  const trend = regime.startsWith("TREND_UP")
    ? "растёт"
    : regime.startsWith("TREND_DOWN")
      ? "снижается"
      : "без ясного тренда";
  return `${trend}, ${vol}`;
}

export function confidenceLabel(conf: number): string {
  if (conf >= 78) return "высокая";
  if (conf >= 62) return "средняя";
  return "ниже обычной";
}

export function moodOf(regime: Regime): "calm" | "normal" | "storm" {
  if (regime === "EVENT" || regime.includes("HIGHVOL")) return "storm";
  if (regime.includes("LOWVOL")) return "calm";
  return "normal";
}

function clipHeadline(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= 88) return t;
  return `${t.slice(0, 85).trimEnd()}…`;
}

export function buildDrivers(opts: {
  regime: Regime;
  event: boolean;
  rsi: number;
  newsShock: number;
  newsType?: string;
  tfAligned: boolean;
  trend1h: TrendDir;
  stale: boolean;
  w: number;
  width24?: number;
  expected24?: number;
  price?: number;
  fgValue?: number | null;
  fgClass?: string | null;
  headline?: string;
}): string[] {
  const out: string[] = [];
  const width = opts.width24 != null ? formatPctAbs(opts.width24) : null;
  const typical =
    opts.w <= 0.85 ? "уже обычного" : opts.w >= 1.2 ? "шире обычного" : "около обычной ширины";

  if (opts.expected24 != null && opts.price != null && opts.price > 0) {
    const move = (opts.expected24 - opts.price) / opts.price;
    const px = formatPrice(opts.expected24, priceDecimals(opts.expected24));
    if (Math.abs(move) < 0.004) {
      out.push(
        `Ориентир на сутки почти у текущей цены (${formatPct(move)}). Сильного сдвига нет — смотрите коридор вокруг.`,
      );
    } else {
      const dir = move > 0 ? "вверх" : "вниз";
      out.push(
        `Ориентир на сутки — около ${px} (${formatPct(move)}). Модель клонит ${dir}; коридор — зона, куда цена скорее попадёт.`,
      );
    }
  }

  if (opts.regime === "EVENT") {
    out.push(
      width
        ? `Сейчас резкое движение. Коридор на сутки — около ${width} от цены, специально широкий.`
        : "Сейчас резкое движение — диапазон расширен.",
    );
  } else if (opts.regime.includes("LOWVOL")) {
    out.push(
      width
        ? `Рынок спокойный: коридор на сутки около ${width} — ${typical}.`
        : "Рынок спокойный: колебания меньше обычного, поэтому коридор уже.",
    );
  } else if (opts.regime.includes("HIGHVOL")) {
    out.push(
      width
        ? `Колебания сильнее обычного. Коридор на сутки около ${width}, ${typical}.`
        : "Колебания сильнее обычного — коридор специально шире.",
    );
  } else {
    out.push(
      width
        ? `Обычный день: коридор на сутки около ${width}, ${typical}.`
        : "Обычный режим: ширина около типичной.",
    );
  }

  if (opts.newsShock >= 0.55 && opts.headline) {
    out.push(`Свежий заголовок «${clipHeadline(opts.headline)}» расширил диапазон — сюрприз ещё может доигрываться.`);
  } else if (opts.newsShock >= 0.55) {
    out.push("Свежие сильные новости расширили диапазон — сюрприз ещё может доигрываться.");
  } else {
    const fg = fearGreedPhrase(opts.fgValue ?? null, opts.fgClass ?? null);
    if (fg && opts.fgValue != null) {
      const extreme = opts.fgValue <= 25 || opts.fgValue >= 75;
      out.push(
        extreme
          ? `Настроение рынка: ${fg}. Это крайность, поэтому границы чуть осторожнее.`
          : `Настроение рынка: ${fg}. Не экстремум — границы почти не сдвигаем.`,
      );
    } else if (opts.tfAligned) {
      out.push(
        opts.trend1h === "up"
          ? "Часы, 4 часа и день смотрят вверх — направление совпадает."
          : "Часы, 4 часа и день смотрят вниз — направление совпадает.",
      );
    } else if (opts.stale) {
      out.push("Котировки подтянулись не полностью — диапазон расширен на всякий случай.");
    } else {
      out.push("Сильных заголовков за последние часы нет — новости почти не двигают ширину.");
    }
  }

  return out.slice(0, 3);
}

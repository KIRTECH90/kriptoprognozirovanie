export function priceDecimals(n: number): number {
  const a = Math.abs(n);
  if (a >= 100) return 2;
  if (a >= 1) return 3;
  if (a >= 0.1) return 4;
  if (a >= 0.01) return 5;
  if (a >= 0.0001) return 6;
  return 8;
}

export function formatPrice(n: number, decimals = priceDecimals(n)): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatPct(n: number, digits = 1): string {
  const signed = n > 0 ? "+" : "";
  return `${signed}${(n * 100).toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatPctAbs(n: number, digits = 1): string {
  return `${(Math.abs(n) * 100).toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatOdds(p: number): string {
  if (Math.abs(p - 0.75) < 0.03) return "3 из 4";
  if (Math.abs(p - 0.8) < 0.03) return "4 из 5";
  const denom = 10;
  return `${Math.round(p * denom)} из ${denom}`;
}

export function formatTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function formatAgo(ts: number, now: number): string {
  if (!Number.isFinite(ts)) return "";
  const m = Math.max(0, Math.round((now - ts) / 60_000));
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  return `${d} дн. назад`;
}

export function fearGreedPhrase(value: number | null, classification: string | null): string | null {
  if (value == null) return classification;
  let mood = "нейтрально";
  if (value <= 24) mood = "крайний страх";
  else if (value <= 44) mood = "страх";
  else if (value <= 55) mood = "нейтрально";
  else if (value <= 74) mood = "жадность";
  else mood = "крайняя жадность";
  return `${value} из 100 · ${mood}`;
}

export function rsiPhrase(rsi: number): { value: string; detail: string } {
  const n = Number.isFinite(rsi) ? Math.round(rsi) : 50;
  if (n <= 30) return { value: String(n), detail: "перепродан" };
  if (n <= 40) return { value: String(n), detail: "слабый ход" };
  if (n < 60) return { value: String(n), detail: "спокойно" };
  if (n < 70) return { value: String(n), detail: "натянут вверх" };
  return { value: String(n), detail: "перекуплен" };
}

export function volumePhrase(ratio: number): { value: string; detail: string } {
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const value = `${r.toLocaleString("ru-RU", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}×`;
  if (r >= 2.2) return { value, detail: "резко выше обычного" };
  if (r >= 1.4) return { value, detail: "выше обычного" };
  if (r <= 0.7) return { value, detail: "тише обычного" };
  return { value, detail: "как обычно" };
}

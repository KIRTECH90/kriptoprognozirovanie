import { FETCH_TIMEOUT_MS } from "@/lib/corridor/config.ts";
import type { DerivativesSnap } from "@/lib/corridor/derivatives.ts";

const FAPI = "https://fapi.binance.com";

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.min(2500, FETCH_TIMEOUT_MS));
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Corridor/1.0" },
    });
    if (!res.ok) throw new Error(`fapi ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Spot-quoted USDT/USDC pairs only. Missing futures → null, never throws. */
export async function fetchDerivatives(symbol: string): Promise<DerivativesSnap | null> {
  const u = symbol.toUpperCase();
  if (!u.endsWith("USDT") && !u.endsWith("USDC")) return null;
  try {
    const raw = await getJson(`${FAPI}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(u)}`);
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const funding = num(row.lastFundingRate);
    const mark = num(row.markPrice);
    const index = num(row.indexPrice);
    const basis = mark != null && index != null && index > 0 ? (mark - index) / index : null;
    if (funding == null && basis == null) return null;
    return { funding, basis };
  } catch {
    return null;
  }
}

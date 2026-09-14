import { FETCH_TIMEOUT_MS } from "@/lib/corridor/config.ts";
import type { FearGreed } from "@/lib/corridor/types.ts";

export async function fetchFearGreed(): Promise<FearGreed | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { value?: string; value_classification?: string }[];
    };
    const row = json.data?.[0];
    const value = Number(row?.value);
    if (!Number.isFinite(value)) return null;
    return { value, classification: row?.value_classification ?? "" };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

import { DEFAULT_CALIBRATION } from "@/lib/corridor/config.ts";
import type { JournalPayload } from "@/lib/corridor/journal.ts";
import type { Calibration, ForecastBundle } from "@/lib/corridor/types.ts";

type Slot = {
  bundle: ForecastBundle;
  lastAt: number;
  prevSigma24: number | null;
  prevSigma48: number | null;
};

const slots = new Map<string, Slot>();
const calibrations = new Map<string, Calibration>();
const journals = new Map<string, { payload: JournalPayload; at: number }>();

export function getCache(symbol: string): {
  bundle: ForecastBundle | null;
  lastAt: number;
  calibration: Calibration;
  prevSigma24: number | null;
  prevSigma48: number | null;
} {
  const slot = slots.get(symbol);
  return {
    bundle: slot?.bundle ?? null,
    lastAt: slot?.lastAt ?? 0,
    calibration: calibrations.get(symbol) ?? { ...DEFAULT_CALIBRATION },
    prevSigma24: slot?.prevSigma24 ?? null,
    prevSigma48: slot?.prevSigma48 ?? null,
  };
}

export function setCalibration(next: Calibration, symbol = "BTCUSDT") {
  calibrations.set(symbol, next);
}

export function expireForecast(symbol: string) {
  const slot = slots.get(symbol);
  if (slot) slot.lastAt = 0;
}

export function rememberForecast(bundle: ForecastBundle) {
  const symbol = bundle.api.symbol;
  slots.set(symbol, {
    bundle,
    lastAt: Date.now(),
    prevSigma24: bundle.details.sigma24,
    prevSigma48: bundle.details.sigma48,
  });
}

export function latestAny(): ForecastBundle | null {
  let best: Slot | null = null;
  for (const slot of slots.values()) {
    if (!best || slot.lastAt > best.lastAt) best = slot;
  }
  return best?.bundle ?? null;
}

export function metricsFromLogs() {
  const latest = latestAny();
  const symbol = latest?.api.symbol ?? "BTCUSDT";
  const cal = calibrations.get(symbol) ?? DEFAULT_CALIBRATION;
  return {
    n: slots.size,
    coverage_24: cal.last_coverage_24,
    coverage_48: cal.last_coverage_48,
    median_width_24: latest?.api.horizon_24h.width_pct ?? cal.last_median_width_24,
    median_width_48: latest?.api.horizon_48h.width_pct ?? cal.last_median_width_48,
  };
}

export function listLogs() {
  return [...slots.values()].map((s) => s.bundle.api);
}

export function getJournalCache(symbol: string): { payload: JournalPayload; at: number } | null {
  return journals.get(symbol) ?? null;
}

export function setJournalCache(symbol: string, payload: JournalPayload) {
  journals.set(symbol, { payload, at: Date.now() });
}

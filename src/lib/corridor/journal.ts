import type { HitRow, WalkForwardResult } from "./calibrate.ts";
import { TARGET_COV_24, TARGET_COV_48 } from "./config.ts";

export type JournalPayload = {
  symbol: string;
  hours: number;
  n24: number;
  n48: number;
  coverage24: number | null;
  coverage48: number | null;
  medianWidth24: number | null;
  medianWidth48: number | null;
  target24: number;
  target48: number;
  empiricalReady: boolean;
  rows: HitRow[];
};

export function journalFromWalk(symbol: string, wf: WalkForwardResult): JournalPayload {
  const rows = wf.rows.slice().sort((a, b) => b.ts - a.ts).slice(0, 48);
  return {
    symbol,
    hours: wf.hours,
    n24: wf.n24,
    n48: wf.n48,
    coverage24: wf.n24 ? wf.coverage24 : null,
    coverage48: wf.n48 ? wf.coverage48 : null,
    medianWidth24: wf.n24 ? wf.medianWidth24 : null,
    medianWidth48: wf.n48 ? wf.medianWidth48 : null,
    target24: TARGET_COV_24,
    target48: TARGET_COV_48,
    empiricalReady: wf.hours >= 2000,
    rows,
  };
}

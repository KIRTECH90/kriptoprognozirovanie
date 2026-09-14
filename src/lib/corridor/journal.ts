import type { HitRow, WalkForwardResult } from "./calibrate.ts";
import { TARGET_COV_24, TARGET_COV_48 } from "./config.ts";

export type ModelPayload = {
  symbol: string;
  hours: number;
  n24: number;
  n48: number;
  nDays24: number;
  coverage24: number | null;
  coverage48: number | null;
  medianWidth24: number | null;
  medianWidth48: number | null;
  target24: number;
  target48: number;
  empiricalReady: boolean;
  rows: HitRow[];
};

/** Retrospective audit. Kept as an alias so older imports still typecheck. */
export type JournalPayload = ModelPayload;

export type IssuedRow = {
  ts: number;
  price: number;
  low24: number;
  high24: number;
  center24: number;
  width24: number;
  fact24: number | null;
  hit24: boolean | null;
  pending24: boolean;
  low48: number;
  high48: number;
  fact48: number | null;
  hit48: boolean | null;
  pending48: boolean;
};

export type LiveJournalPayload = {
  symbol: string;
  firstAt: number | null;
  nIssued: number;
  nSettled24: number;
  nPending24: number;
  coverage24: number | null;
  nSettled48: number;
  coverage48: number | null;
  target24: number;
  target48: number;
  rows: IssuedRow[];
};

export function liveJournalFromRows(symbol: string, rows: IssuedRow[]): LiveJournalPayload {
  const settled24 = rows.filter((r) => r.hit24 != null);
  const settled48 = rows.filter((r) => r.hit48 != null);
  const hits24 = settled24.filter((r) => r.hit24).length;
  const hits48 = settled48.filter((r) => r.hit48).length;
  return {
    symbol,
    firstAt: rows.length ? Math.min(...rows.map((r) => r.ts)) : null,
    nIssued: rows.length,
    nSettled24: settled24.length,
    nPending24: rows.filter((r) => r.pending24).length,
    coverage24: settled24.length ? hits24 / settled24.length : null,
    nSettled48: settled48.length,
    coverage48: settled48.length ? hits48 / settled48.length : null,
    target24: TARGET_COV_24,
    target48: TARGET_COV_48,
    rows: rows.slice().sort((a, b) => b.ts - a.ts).slice(0, 48),
  };
}

export function journalFromWalk(symbol: string, wf: WalkForwardResult): ModelPayload {
  const rows = wf.rows.slice().sort((a, b) => b.ts - a.ts).slice(0, 48);
  return {
    symbol,
    hours: wf.hours,
    n24: wf.n24,
    n48: wf.n48,
    nDays24: wf.nDays24,
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

import { DEFAULT_CALIBRATION } from "./config.ts";
import type { Calibration, Candle, ForecastBundle, Regime } from "./types.ts";
import { liveJournalFromRows, type IssuedRow, type LiveJournalPayload } from "./journal.ts";
import { getSql } from "@/lib/db";

const ISSUE_GAP_MS = 6 * 3600_000;

type IssuedRowDb = {
  id: number;
  symbol: string;
  issued_at: string | Date;
  price: number;
  regime: string;
  low_24: number;
  high_24: number;
  center_24: number;
  width_24: number;
  low_48: number;
  high_48: number;
  center_48: number;
  width_48: number;
  sigma_24: number | null;
  w: number | null;
  empirical_24: boolean | null;
  fact_24: number | null;
  hit_24: boolean | null;
  settled_24_at: string | Date | null;
  fact_48: number | null;
  hit_48: boolean | null;
  settled_48_at: string | Date | null;
};

export type { IssuedRow, LiveJournalPayload };


type CalRow = {
  symbol: string;
  regime: string;
  q_lo_mult_24: number;
  q_hi_mult_24: number;
  q_lo_mult_48: number;
  q_hi_mult_48: number;
  coverage_24: number | null;
  coverage_48: number | null;
  n_24: number | null;
  n_48: number | null;
  n_days_24: number | null;
  median_width_24: number | null;
  updated_at: string | Date;
};

function tsMs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function closeAt(h1: Candle[], t: number): number | null {
  if (!h1.length) return null;
  const last = h1[h1.length - 1]!;
  if (t > last.openTime + 3600_000) return null;
  let prev: number | null = null;
  for (const c of h1) {
    if (c.openTime >= t) return c.close;
    prev = c.close;
  }
  return prev;
}

function toIssued(row: IssuedRowDb): IssuedRow {
  const ts = tsMs(row.issued_at);
  return {
    ts,
    price: Number(row.price),
    low24: Number(row.low_24),
    high24: Number(row.high_24),
    center24: Number(row.center_24),
    width24: Number(row.width_24),
    fact24: num(row.fact_24),
    hit24: row.hit_24 == null ? null : Boolean(row.hit_24),
    pending24: row.hit_24 == null,
    low48: Number(row.low_48),
    high48: Number(row.high_48),
    fact48: num(row.fact_48),
    hit48: row.hit_48 == null ? null : Boolean(row.hit_48),
    pending48: row.hit_48 == null,
  };
}

export async function issueForecast(bundle: ForecastBundle, now = Date.now()): Promise<boolean> {
  const sql = await getSql();
  const symbol = bundle.api.symbol;
  const last = await sql<{ issued_at: string | Date }>`
    select issued_at from corridor_issued
    where symbol = ${symbol}
    order by issued_at desc
    limit 1
  `;
  const lastTs = last[0] ? tsMs(last[0].issued_at) : 0;
  if (lastTs && now - lastTs < ISSUE_GAP_MS) return false;
  const a = bundle.api;
  await sql`
    insert into corridor_issued (
      symbol, issued_at, price, regime,
      low_24, high_24, center_24, width_24,
      low_48, high_48, center_48, width_48,
      sigma_24, w, empirical_24
    ) values (
      ${symbol},
      ${new Date(now).toISOString()},
      ${a.price},
      ${a.regime},
      ${a.horizon_24h.low},
      ${a.horizon_24h.high},
      ${a.horizon_24h.center},
      ${a.horizon_24h.width_pct},
      ${a.horizon_48h.low},
      ${a.horizon_48h.high},
      ${a.horizon_48h.center},
      ${a.horizon_48h.width_pct},
      ${bundle.details.sigma24},
      ${bundle.details.w},
      ${bundle.details.empirical24}
    )
  `;
  return true;
}

export async function settleIssued(symbol: string, h1: Candle[], now = Date.now()): Promise<number> {
  const sql = await getSql();
  const open = await sql<IssuedRowDb>`
    select * from corridor_issued
    where symbol = ${symbol}
      and (hit_24 is null or hit_48 is null)
    order by issued_at asc
    limit 200
  `;
  let n = 0;
  for (const row of open) {
    const issued = tsMs(row.issued_at);
    if (!Number.isFinite(issued)) continue;
    const t24 = issued + 24 * 3600_000;
    const t48 = issued + 48 * 3600_000;
    const id = Number(row.id);
    if (row.hit_24 == null && now >= t24) {
      const fact = closeAt(h1, t24);
      if (fact != null) {
        const hit = fact >= Number(row.low_24) && fact <= Number(row.high_24);
        await sql`
          update corridor_issued
          set fact_24 = ${fact}, hit_24 = ${hit}, settled_24_at = ${new Date(now).toISOString()}
          where id = ${id}
        `;
        n++;
      }
    }
    if (row.hit_48 == null && now >= t48) {
      const fact = closeAt(h1, t48);
      if (fact != null) {
        const hit = fact >= Number(row.low_48) && fact <= Number(row.high_48);
        await sql`
          update corridor_issued
          set fact_48 = ${fact}, hit_48 = ${hit}, settled_48_at = ${new Date(now).toISOString()}
          where id = ${id}
        `;
        n++;
      }
    }
  }
  return n;
}

export async function loadLiveJournal(symbol: string): Promise<LiveJournalPayload> {
  const sql = await getSql();
  const raw = await sql<IssuedRowDb>`
    select * from corridor_issued
    where symbol = ${symbol}
    order by issued_at desc
    limit 48
  `;
  return liveJournalFromRows(symbol, raw.map(toIssued));
}

export async function loadCalibration(symbol: string): Promise<Calibration | null> {
  const sql = await getSql();
  const rows = await sql<CalRow>`
    select * from corridor_calibration where symbol = ${symbol}
  `;
  if (!rows.length) return null;
  const base = rows.find((r) => r.regime === "") ?? rows[0]!;
  const byRegime: NonNullable<Calibration["byRegime"]> = {};
  for (const r of rows) {
    if (!r.regime) continue;
    byRegime[r.regime as Regime] = {
      q_lo_mult_24: Number(r.q_lo_mult_24),
      q_hi_mult_24: Number(r.q_hi_mult_24),
      q_lo_mult_48: Number(r.q_lo_mult_48),
      q_hi_mult_48: Number(r.q_hi_mult_48),
    };
  }
  return {
    q_lo_mult_24: Number(base.q_lo_mult_24),
    q_hi_mult_24: Number(base.q_hi_mult_24),
    q_lo_mult_48: Number(base.q_lo_mult_48),
    q_hi_mult_48: Number(base.q_hi_mult_48),
    last_coverage_24: num(base.coverage_24),
    last_median_width_24: num(base.median_width_24),
    last_coverage_48: num(base.coverage_48),
    last_median_width_48: null,
    updated_at: new Date(tsMs(base.updated_at)).toISOString(),
    byRegime: Object.keys(byRegime).length ? byRegime : undefined,
  };
}

export async function saveCalibration(symbol: string, cal: Calibration): Promise<void> {
  const sql = await getSql();
  const upsert = async (
    regime: string,
    lo24: number,
    hi24: number,
    lo48: number,
    hi48: number,
    cov24: number | null,
    cov48: number | null,
    n24: number | null,
    n48: number | null,
    nDays: number | null,
    medW: number | null,
  ) => {
    await sql`
      insert into corridor_calibration (
        symbol, regime, q_lo_mult_24, q_hi_mult_24, q_lo_mult_48, q_hi_mult_48,
        coverage_24, coverage_48, n_24, n_48, n_days_24, median_width_24, updated_at
      ) values (
        ${symbol}, ${regime}, ${lo24}, ${hi24}, ${lo48}, ${hi48},
        ${cov24}, ${cov48}, ${n24}, ${n48}, ${nDays}, ${medW}, ${new Date().toISOString()}
      )
      on conflict (symbol, regime) do update set
        q_lo_mult_24 = excluded.q_lo_mult_24,
        q_hi_mult_24 = excluded.q_hi_mult_24,
        q_lo_mult_48 = excluded.q_lo_mult_48,
        q_hi_mult_48 = excluded.q_hi_mult_48,
        coverage_24 = excluded.coverage_24,
        coverage_48 = excluded.coverage_48,
        n_24 = excluded.n_24,
        n_48 = excluded.n_48,
        n_days_24 = excluded.n_days_24,
        median_width_24 = excluded.median_width_24,
        updated_at = excluded.updated_at
    `;
  };
  await upsert(
    "",
    cal.q_lo_mult_24,
    cal.q_hi_mult_24,
    cal.q_lo_mult_48,
    cal.q_hi_mult_48,
    cal.last_coverage_24,
    cal.last_coverage_48,
    null,
    null,
    null,
    cal.last_median_width_24,
  );
  if (cal.byRegime) {
    for (const [regime, m] of Object.entries(cal.byRegime)) {
      if (!m) continue;
      await upsert(regime, m.q_lo_mult_24, m.q_hi_mult_24, m.q_lo_mult_48, m.q_hi_mult_48, null, null, null, null, null, null);
    }
  }
}

export { DEFAULT_CALIBRATION, ISSUE_GAP_MS };

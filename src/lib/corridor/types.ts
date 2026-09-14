export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CandleSet = {
  m15: Candle[];
  h1: Candle[];
  h4: Candle[];
  d1: Candle[];
};

export type TrendDir = "up" | "down" | "range";
export type VolBucket = "LOWVOL" | "MIDVOL" | "HIGHVOL";

export type Regime =
  | "TREND_UP_LOWVOL"
  | "TREND_UP_MIDVOL"
  | "TREND_UP_HIGHVOL"
  | "RANGE_LOWVOL"
  | "RANGE_MIDVOL"
  | "RANGE_HIGHVOL"
  | "TREND_DOWN_LOWVOL"
  | "TREND_DOWN_MIDVOL"
  | "TREND_DOWN_HIGHVOL"
  | "EVENT";

export type NewsType =
  | "HACK"
  | "REGULATION"
  | "MACRO"
  | "LISTING"
  | "ADOPTION"
  | "RUMOR"
  | "NOISE";

export type NewsItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: number;
  coins: string[];
  rawText: string;
};

export type ScoredNews = NewsItem & {
  type: NewsType;
  polarity: -1 | 0 | 1;
  severity: number;
  novelty: number;
  shock: number;
};

export type NewsAggregate = {
  items: ScoredNews[];
  newsShift: number;
  newsShock: number;
  staleNews: boolean;
};

export type FearGreed = {
  value: number;
  classification: string;
};

export type Calibration = {
  q_lo_mult_24: number;
  q_hi_mult_24: number;
  q_lo_mult_48: number;
  q_hi_mult_48: number;
  last_coverage_24: number | null;
  last_median_width_24: number | null;
  last_coverage_48: number | null;
  last_median_width_48: number | null;
  updated_at: string | null;
};

export type HorizonBand = {
  center: number;
  expected: number;
  low: number;
  high: number;
  width_pct: number;
  target_coverage: number;
};

export type ForecastResponse = {
  symbol: string;
  ts: string;
  price: number;
  horizon_24h: HorizonBand;
  horizon_48h: HorizonBand;
  regime: Regime;
  confidence: number;
  drivers: string[];
  disclaimer: string;
  stale: boolean;
};

export type ForecastDetails = {
  rsi: number;
  atrPct1h: number;
  atrPct4h: number;
  sigma24: number;
  sigma48: number;
  mu24: number;
  mu48: number;
  muRaw24: number;
  muRaw48: number;
  realized24: number;
  w: number;
  newsShift: number;
  newsShock: number;
  fgValue: number | null;
  fgClass: string | null;
  fgAdj: number;
  volRatio: number;
  bbWidth: number;
  bbPos: number;
  event: boolean;
  staleNews: boolean;
  trend1h: TrendDir;
  trend4h: TrendDir;
  trend1d: TrendDir;
  tfAligned: boolean;
  sTa: number;
  source: "live" | "snapshot";
  headlines: { title: string; type: NewsType; polarity: number }[];
  calibration: Calibration;
};

export type ForecastBundle = {
  api: ForecastResponse;
  details: ForecastDetails;
};

export type WidthInputs = {
  regime: Regime;
  event: boolean;
  newsShock: number;
  bbWidth: number;
  bbWidthMedian30d: number;
  rsi: number;
  trend1h: TrendDir;
  trend4h: TrendDir;
  trend1d: TrendDir;
  volRatio: number;
  stale: boolean;
};

export type EngineInput = {
  symbol: string;
  candles: CandleSet;
  news: NewsItem[];
  fearGreed: FearGreed | null;
  staleCandles: boolean;
  staleNews: boolean;
  prevSigma24: number | null;
  prevSigma48: number | null;
  calibration: Calibration;
  now: number;
  source: "live" | "snapshot";
  skipEmpirical?: boolean;
};

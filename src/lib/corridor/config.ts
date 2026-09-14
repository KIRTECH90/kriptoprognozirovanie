/** All algorithm magic numbers live here. Nothing else hardcodes them. */

import type { Calibration } from "./types.ts";

export const SYMBOL = "BTCUSDT";
export const UPDATE_MINUTES = 10;

export const TARGET_COV_24 = 0.75;
export const TARGET_COV_48 = 0.80;

export const KAPPA_24 = 0.28;
export const KAPPA_48 = 0.22;

export const W_MIN = 0.72;
export const W_MAX = 1.7;

export const MIN_WIDTH_24 = 0.012;
export const MIN_WIDTH_48 = 0.018;
export const MAX_WIDTH_24_NORMAL = 0.09;
export const MAX_WIDTH_24_EVENT = 0.14;
export const MAX_WIDTH_48_NORMAL = 0.12;
export const MAX_WIDTH_48_EVENT = 0.18;

export const SMOOTH_SIGMA = 0.65;
export const SMOOTH_SIGMA_PREV = 1 - SMOOTH_SIGMA;

export const NEWS_WINDOW_HOURS = 6;
export const NEWS_NOVELTY_HOURS = 24;
export const NEWS_DEDUP_THRESHOLD = 0.72;
export const NEWS_MAX_IN_SUM = 8;
export const NEWS_SHIFT_CLIP = 1.2;
export const NEWS_SHOCK_CLIP = 1.5;
export const NEWS_EVENT_THRESHOLD = 0.55;
export const NEWS_CALM_SHOCK = 0.25;
export const RUMOR_SEVERITY_MULT = 0.45;
export const NOISE_SEVERITY_MULT = 0.25;

export const KLINES_15M = 300;
export const KLINES_1H = 500;
export const KLINES_4H = 400;
export const KLINES_1D = 400;

export const EMA_FAST = 20;
export const EMA_MID = 50;
export const EMA_SLOW = 200;
export const RSI_PERIOD = 14;
export const ATR_PERIOD = 14;
export const MACD_FAST = 12;
export const MACD_SLOW = 26;
export const MACD_SIGNAL = 9;
export const BB_PERIOD = 20;
export const BB_K = 2;
export const VOL_SMA_PERIOD = 20;

export const SIGMA_CC_HOURS_24 = 24;
export const SIGMA_CC_HOURS_48 = 48;
export const SIGMA24_ATR_W = 0.45;
export const SIGMA24_CC_W = 0.35;
export const SIGMA24_PK_W = 0.2;
export const SIGMA48_ATR_W = 0.4;
export const SIGMA48_CC_W = 0.4;
export const SIGMA48_PK_W = 0.2;
export const SIGMA24_ATR_BARS = 24;
export const SIGMA48_ATR_4H_BARS = 12;
export const SIGMA_FLOOR_MULT = 0.55;
export const SIGMA_CEIL_MULT = 2.4;
export const SIGMA_MEDIAN_DAYS = 90;

export const TREND_STRONG_SEP = 0.8;
export const VOL_HIGH_MULT = 1.25;
export const VOL_LOW_MULT = 0.8;
export const EVENT_ATR_MULT = 1.8;
export const EVENT_RET_SIGMA_MULT = 1.2;
export const EVENT_LOOKBACK_HOURS = 3;
export const ATR_MEDIAN_DAYS = 30;
export const BB_MEDIAN_DAYS = 30;

export const STA_TREND = 0.3;
export const STA_EMA20 = 0.15;
export const STA_RSI_SCALE = 100;
export const STA_RSI_CLIP = 0.2;
export const STA_MACD_SCALE = 0.1;
export const STA_MACD_CLIP = 0.15;

export const MU24_TA = 0.55;
export const MU24_RET = 0.25;
export const MU24_NEWS = 0.2;
export const MU48_TA = 0.5;
export const MU48_RET = 0.2;
export const MU48_NEWS = 0.3;
export const FG_MU24 = 0.15;
export const FG_MU48 = 0.12;
export const FG_SCALE = 200;
export const MU24_CLIP_SIGMA = 0.45;
export const MU48_CLIP_SIGMA = 0.5;

export const Z75 = 1.15;
export const Z80 = 1.28;
export const EMPIRICAL_MIN_SAMPLES = 80;
export const EMPIRICAL_LOOKBACK_DAYS = 400;
export const EMPIRICAL_Q_LO_24 = 0.125;
export const EMPIRICAL_Q_HI_24 = 0.875;
export const EMPIRICAL_Q_LO_48 = 0.1;
export const EMPIRICAL_Q_HI_48 = 0.9;
export const EMPIRICAL_MAD_FACTOR = 1.2533;
export const EMPIRICAL_SCALE_MIN = 0.7;
export const EMPIRICAL_SCALE_MAX = 1.6;

export const W_LOWVOL_COMPRESS = 0.82;
export const W_TF_ALIGN_COMPRESS = 0.9;
export const W_EVENT_EXPAND = 1.35;
export const W_HIGHVOL_EXPAND = 1.18;
export const W_NEWS_SHOCK_K = 0.25;
export const W_VOL_RATIO_EXPAND = 1.08;
export const W_STALE_EXPAND = 1.15;
export const W_VOL_RATIO_TRIGGER = 2.0;
export const RSI_CALM_LO = 35;
export const RSI_CALM_HI = 65;

export const ASYM_RSI_DIV = 80;
export const ASYM_RSI_CLIP = 0.35;
export const ASYM_LO_K = 0.35;
export const ASYM_HI_K = 0.25;
export const ASYM_NEWS_LO_K = 0.2;
export const ASYM_NEWS_HI_K = 0.15;

export const MIN_LOG_SPAN = 0.003;

export const CONF_BASE = 78;
export const CONF_EVENT = 18;
export const CONF_HIGHVOL = 10;
export const CONF_NEWS = 8;
export const CONF_LOWVOL = 8;
export const CONF_TF_ALIGN = 6;
export const CONF_STALE = 12;
export const CONF_MIN = 25;
export const CONF_MAX = 88;

export const CAL_COVERAGE_UNDER = 0.04;
export const CAL_COVERAGE_OVER = 0.05;
export const CAL_WIDEN = 0.06;
export const CAL_NARROW = 0.05;
export const CAL_Z_MIN_24 = 0.95;
export const CAL_Z_MAX_24 = 1.5;
export const CAL_STEP_HOURS = 4;

export const STALE_KLINES_EXPAND = 0.15;

export const BINANCE_HOSTS = [
  "https://api.binance.com",
  "https://data-api.binance.vision",
  "https://api.binance.us",
] as const;

export const FETCH_TIMEOUT_MS = 8000;
export const DISCLAIMER =
  "Калиброванный диапазон, не обещание цены. Не финансовый совет.";

export const PRICE_DECIMALS = 2;
export const WIDTH_DECIMALS = 4;

export const DEFAULT_CALIBRATION: Calibration = {
  q_lo_mult_24: 1,
  q_hi_mult_24: 1,
  q_lo_mult_48: 1,
  q_hi_mult_48: 1,
  last_coverage_24: null,
  last_median_width_24: null,
  last_coverage_48: null,
  last_median_width_48: null,
  updated_at: null,
};

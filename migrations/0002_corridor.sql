-- Issued live forecasts and per-pair calibration. Unowned (no user_id): this is
-- the model's log, not a personal account. Auth stays off.
create table if not exists corridor_issued (
  id bigserial primary key,
  symbol text not null,
  issued_at timestamptz not null,
  price double precision not null,
  regime text not null,
  low_24 double precision not null,
  high_24 double precision not null,
  center_24 double precision not null,
  width_24 double precision not null,
  low_48 double precision not null,
  high_48 double precision not null,
  center_48 double precision not null,
  width_48 double precision not null,
  sigma_24 double precision,
  w double precision,
  empirical_24 boolean,
  fact_24 double precision,
  hit_24 boolean,
  settled_24_at timestamptz,
  fact_48 double precision,
  hit_48 boolean,
  settled_48_at timestamptz
);
create index if not exists corridor_issued_symbol_issued_idx
  on corridor_issued (symbol, issued_at desc);

create table if not exists corridor_calibration (
  symbol text not null,
  regime text not null default '',
  q_lo_mult_24 double precision not null default 1,
  q_hi_mult_24 double precision not null default 1,
  q_lo_mult_48 double precision not null default 1,
  q_hi_mult_48 double precision not null default 1,
  coverage_24 double precision,
  coverage_48 double precision,
  n_24 integer,
  n_48 integer,
  n_days_24 integer,
  median_width_24 double precision,
  updated_at timestamptz not null default now(),
  primary key (symbol, regime)
);

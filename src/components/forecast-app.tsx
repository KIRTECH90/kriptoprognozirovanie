import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { CorridorBar } from "@/components/corridor-bar.tsx";
import { MarketPicker } from "@/components/market-picker.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { getForecastFn } from "@/lib/forecast.ts";
import {
  fearGreedPhrase,
  formatClock,
  formatOdds,
  formatPct,
  formatPctAbs,
  formatPrice,
  formatTime,
  priceDecimals,
} from "@/lib/format.ts";
import { quotesFor } from "@/lib/markets.ts";
import { confidenceLabel, moodOf, regimeLabel } from "@/lib/corridor/drivers.ts";
import type { ForecastBundle, HorizonBand } from "@/lib/corridor/types.ts";
import { cn } from "@/lib/utils.ts";

const AUTO_KEY = "corridor.autoRefreshMin";
const AUTO_OPTS = [15, 30, 60] as const;

function readAuto(): number {
  if (typeof window === "undefined") return 15;
  const raw = window.localStorage.getItem(AUTO_KEY);
  if (raw == null || raw === "") return 15;
  const n = Number(raw);
  if (n === 0) return 0;
  return AUTO_OPTS.includes(n as (typeof AUTO_OPTS)[number]) ? n : 15;
}

export function ForecastApp({
  bundle: bundleProp,
  asset: assetProp,
  quote: quoteProp,
}: {
  bundle: ForecastBundle;
  asset: string;
  quote: string;
}) {
  const navigate = useNavigate();
  const [bundle, setBundle] = useState(bundleProp);
  const [asset, setAsset] = useState(assetProp);
  const [quote, setQuote] = useState(quoteProp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoMin, setAutoMin] = useState(15);
  const [nowTs, setNowTs] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const reqId = useRef(0);
  const lastFetch = useRef(Date.now());

  useEffect(() => {
    setBundle(bundleProp);
    setAsset(assetProp);
    setQuote(quoteProp);
    setError(null);
    lastFetch.current = Date.now();
  }, [bundleProp, assetProp, quoteProp]);

  useEffect(() => {
    setHydrated(true);
    setAutoMin(readAuto());
    setNowTs(Date.now());
    lastFetch.current = Date.now();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [hydrated]);

  useEffect(() => {
    if (!autoMin) return;
    const tick = window.setInterval(() => {
      if (Date.now() - lastFetch.current >= autoMin * 60_000) {
        void loadPair(asset, quote, true);
      }
    }, 15_000);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMin, asset, quote]);

  async function loadPair(nextAsset: string, nextQuote: string, force = false) {
    const id = ++reqId.current;
    setAsset(nextAsset);
    setQuote(nextQuote);
    setBusy(true);
    setError(null);
    try {
      const next = await getForecastFn({
        data: { refresh: force, symbol: `${nextAsset}${nextQuote}` },
      });
      if (id !== reqId.current) return;
      setBundle(next);
      lastFetch.current = Date.now();
      await navigate({ to: "/", search: { asset: nextAsset, quote: nextQuote }, replace: true });
    } catch {
      if (id !== reqId.current) return;
      setError(`Пары ${nextAsset}/${nextQuote} сейчас нет. Выберите другую котировку.`);
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

  function selectAsset(next: string) {
    const allowed = quotesFor(next);
    const q = allowed.some((x) => x.id === quote) ? quote : allowed[0]!.id;
    void loadPair(next, q, false);
  }

  function selectQuote(next: string) {
    void loadPair(asset, next, false);
  }

  function setAuto(n: number) {
    setAutoMin(n);
    try {
      window.localStorage.setItem(AUTO_KEY, String(n));
    } catch {
      /* ignore */
    }
  }

  const api = bundle.api;
  const dec = priceDecimals(api.price);
  const switching = busy || (api.symbol !== `${asset}${quote}` && !error);
  const mood = moodOf(api.regime);
  const moodTone = mood === "storm" ? "event" : mood === "calm" ? "ok" : "neutral";
  const fg = fearGreedPhrase(bundle.details.fgValue, bundle.details.fgClass);
  const domainMin = Math.min(api.horizon_48h.low, api.horizon_24h.low, api.price);
  const domainMax = Math.max(api.horizon_48h.high, api.horizon_24h.high, api.price);
  const nextIn = autoMin ? autoMin * 60_000 - (nowTs - lastFetch.current) : 0;
  const realized = bundle.details.realized24;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-16 pt-5 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-subtle">Прогноз цены</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Коридор</h1>
        </div>
        <Button
          variant="secondary"
          onClick={() => void loadPair(asset, quote, true)}
          disabled={busy}
          className="shrink-0 px-3"
        >
          <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          Проверить
        </Button>
      </header>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {AUTO_OPTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setAuto(n)}
            className={cn(
              "h-11 rounded-full px-3.5 text-sm font-medium transition-colors duration-150",
              autoMin === n ? "bg-fg text-bg" : "bg-surface text-fg shadow-[var(--shadow-border)]",
            )}
          >
            {n} мин
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAuto(0)}
          className={cn(
            "h-11 rounded-full px-3.5 text-sm font-medium transition-colors duration-150",
            autoMin === 0 ? "bg-fg text-bg" : "bg-surface text-fg shadow-[var(--shadow-border)]",
          )}
        >
          Выкл
        </button>
        <span className="text-xs text-subtle">
          {!hydrated
            ? "авто 15 мин"
            : autoMin
              ? `след. ${formatClock(nextIn)}`
              : "вручную"}
        </span>
      </div>

      <section className="mt-6">
        <MarketPicker asset={asset} quote={quote} onAsset={selectAsset} onQuote={selectQuote} />
      </section>

      {error ? <p className="mt-4 text-sm text-event">{error}</p> : null}

      <section
        className={cn(
          "mt-6 rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)] transition-opacity duration-150",
          switching && "opacity-50",
        )}
      >
        <p className="text-sm text-muted">Сейчас · {asset}/{quote}</p>
        <p className="mt-1 font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
          {formatPrice(api.price, dec)}
          <span className="ml-2 font-sans text-base font-medium text-muted">{quote}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={moodTone}>{regimeLabel(api.regime)}</Badge>
          <Badge tone="neutral">Уверенность {confidenceLabel(api.confidence)}</Badge>
          {api.stale ? <Badge tone="warn">Данные несвежие</Badge> : null}
        </div>
        <p className="mt-3 text-sm text-muted">
          За прошлые сутки {formatPct(Math.exp(realized) - 1)}
          {fg ? ` · настроение ${fg}` : null}
        </p>
        <p className="mt-2 text-xs text-subtle">обновлено {formatTime(api.ts)}</p>
      </section>

      <HorizonCard
        title="Через 24 часа"
        band={api.horizon_24h}
        price={api.price}
        quote={quote}
        event={api.regime === "EVENT"}
        dim={switching}
        domainMin={domainMin}
        domainMax={domainMax}
        hero
      />
      <HorizonCard
        title="Через 48 часов"
        band={api.horizon_48h}
        price={api.price}
        quote={quote}
        event={api.regime === "EVENT"}
        dim={switching}
        domainMin={domainMin}
        domainMax={domainMax}
      />

      <section className="mt-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="text-base font-semibold">Почему так</h2>
        <ol className="mt-4 space-y-4">
          {api.drivers.map((line, i) => (
            <li key={line} className="flex gap-3 text-sm leading-relaxed text-fg">
              <span className="mt-0.5 w-4 shrink-0 font-mono text-xs text-subtle">{i + 1}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Ориентир — куда клонит модель. Коридор — зона, где цена скорее всего проживёт это время. Если выйдет за край, сценарий не сработал.
        </p>
      </section>

      <p className="mt-8 text-center text-xs leading-relaxed text-subtle">
        {api.disclaimer} Это не сигнал купить или продать.
      </p>
    </div>
  );
}

function HorizonCard({
  title,
  band,
  price,
  quote,
  event,
  dim,
  domainMin,
  domainMax,
  hero,
}: {
  title: string;
  band: HorizonBand;
  price: number;
  quote: string;
  event: boolean;
  dim: boolean;
  domainMin: number;
  domainMax: number;
  hero?: boolean;
}) {
  const dec = priceDecimals(price);
  const move = (band.expected - price) / price;
  const down = (band.low - price) / price;
  const up = (band.high - price) / price;
  const flat = Math.abs(move) < 0.004;
  return (
    <section
      className={cn(
        "mt-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)] transition-opacity duration-150",
        dim && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-right text-xs text-subtle">коридор {formatPctAbs(band.width_pct)}</p>
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-subtle">Ориентир</p>
      <p
        className={cn(
          "font-mono font-semibold tabular-nums tracking-tight",
          hero ? "text-3xl sm:text-4xl" : "text-2xl",
        )}
      >
        {formatPrice(band.expected, dec)}
        <span className="ml-2 font-sans text-sm font-medium text-muted">{quote}</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        {flat ? "почти как сейчас" : `${formatPct(move)} от текущей`}
      </p>
      <p className="mt-4 text-sm text-muted">
        Коридор, внутри которого цена скорее останется · в {formatOdds(band.target_coverage)} похожих дней так и было
      </p>
      <p className="mt-2 font-mono text-base font-medium tabular-nums tracking-tight sm:text-lg">
        {formatPrice(band.low, dec)}
        <span className="mx-2 font-sans font-normal text-subtle">—</span>
        {formatPrice(band.high, dec)}
      </p>
      <div className="mt-4">
        <CorridorBar
          price={price}
          low={band.low}
          high={band.high}
          expected={band.expected}
          domainMin={domainMin}
          domainMax={domainMax}
          accent={event ? "event" : "accent"}
        />
      </div>
      <div className="mt-3 flex justify-between text-xs text-subtle">
        <span>точка — сейчас</span>
        <span>чёрточка — ориентир</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <p className="rounded-[var(--radius-sm)] bg-bg-elevated px-3 py-2.5">
          <span className="block text-xs text-subtle">Если вниз</span>
          <span className="font-mono text-sm font-medium tabular-nums">{formatPct(down)}</span>
        </p>
        <p className="rounded-[var(--radius-sm)] bg-bg-elevated px-3 py-2.5 text-right">
          <span className="block text-xs text-subtle">Если вверх</span>
          <span className="font-mono text-sm font-medium tabular-nums">{formatPct(up)}</span>
        </p>
      </div>
    </section>
  );
}

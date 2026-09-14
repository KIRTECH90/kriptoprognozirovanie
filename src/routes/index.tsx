import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { ForecastApp } from "@/components/forecast-app";
import { Button } from "@/components/ui/button";
import { getForecastFn } from "@/lib/forecast";
import { normalizePair } from "@/lib/markets";

type Search = { asset: string; quote: string };

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>): Search => {
    const n = normalizePair(String(raw.asset ?? "BTC"), String(raw.quote ?? "USDT"));
    return { asset: n.asset, quote: n.quote };
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const symbol = `${deps.asset}${deps.quote}`;
    try {
      return await getForecastFn({ data: { symbol } });
    } catch {
      throw new Error(`Пары ${deps.asset}/${deps.quote} сейчас нет. Выберите другую котировку.`);
    }
  },
  component: Home,
  pendingComponent: Pending,
  errorComponent: PairError,
  pendingMs: 400,
});

function Home() {
  const bundle = Route.useLoaderData();
  const search = Route.useSearch();
  return <ForecastApp bundle={bundle} asset={search.asset} quote={search.quote} />;
}

function Pending() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-5">
      <p className="text-xs font-medium uppercase tracking-widest text-subtle">Прогноз цены</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Коридор</h1>
      <p className="mt-2 text-sm text-muted">Считаю ориентир…</p>
      <div className="mt-6 h-16 animate-pulse rounded-[var(--radius-lg)] bg-surface" />
      <div className="mt-6 h-40 animate-pulse rounded-[var(--radius-xl)] bg-surface" />
      <div className="mt-4 h-48 animate-pulse rounded-[var(--radius-lg)] bg-surface" />
    </main>
  );
}

function PairError({ error }: ErrorComponentProps) {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const asset = search?.asset ?? "BTC";
  const message = error instanceof Error ? error.message : "Не удалось загрузить пару.";
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-5">
      <p className="text-xs font-medium uppercase tracking-widest text-subtle">Прогноз цены</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Коридор</h1>
      <p className="mt-6 text-sm leading-relaxed text-event">{message}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => void navigate({ to: "/", search: { asset, quote: "USDT" } })}>
          Открыть {asset} в USDT
        </Button>
        <Button
          variant="secondary"
          onClick={() => void navigate({ to: "/", search: { asset: "BTC", quote: "USDT" } })}
        >
          К Bitcoin
        </Button>
      </div>
    </main>
  );
}

import { formatPct, formatPctAbs, formatPrice, formatTime, priceDecimals } from "@/lib/format.ts";
import type { JournalPayload } from "@/lib/corridor/journal.ts";
import { cn } from "@/lib/utils.ts";

export function HitJournal({
  data,
  busy,
  error,
}: {
  data: JournalPayload | null;
  busy: boolean;
  error: string | null;
}) {
  if (busy && !data) {
    return <p className="mt-6 text-sm text-muted">Считаю попадания по истории этой пары…</p>;
  }
  if (error && !data) return <p className="mt-6 text-sm text-event">{error}</p>;
  if (!data) return null;

  const cov = data.coverage24;
  const n = data.n24;
  const ok = cov != null && n >= 20 && cov >= data.target24 - 0.04;
  const weak = cov != null && n >= 20 && cov < data.target24 - 0.08;
  const dec = data.rows[0] ? priceDecimals(data.rows[0].price) : 2;

  return (
    <div className={cn("mt-6", busy && "opacity-60")}>
      <section className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]">
        <p className="text-xs font-medium uppercase tracking-widest text-subtle">Попадания 24 часа</p>
        <p className="mt-2 font-mono text-4xl font-semibold tabular-nums tracking-tight">
          {cov == null ? "—" : `${Math.round(cov * 100)}%`}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fg">
          {n < 20
            ? `Пока мало окон (${n}). Рано говорить, врёт модель или нет.`
            : `Из ${n} суток факт закрылся внутри коридора ${Math.round((cov ?? 0) * n)} раз. Цель — ${Math.round(data.target24 * 100)}%.`}
        </p>
        <p className={cn("mt-2 text-sm", ok ? "text-ok" : weak ? "text-event" : "text-muted")}>
          {cov == null
            ? "Нет фактов."
            : ok
              ? "Похоже на заявленное покрытие."
              : weak
                ? "Пока хуже цели — коридор либо узкий, либо режим редкий."
                : "Около цели, но это ещё не доказанная калибровка на месяцах."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <p className="rounded-[var(--radius-sm)] bg-bg-elevated px-3 py-2.5">
            <span className="block text-xs text-subtle">48 часов</span>
            <span className="font-mono text-sm font-medium tabular-nums">
              {data.coverage48 == null ? "—" : `${Math.round(data.coverage48 * 100)}%`}
            </span>
            <span className="mt-0.5 block text-xs text-muted">{data.n48} окон</span>
          </p>
          <p className="rounded-[var(--radius-sm)] bg-bg-elevated px-3 py-2.5">
            <span className="block text-xs text-subtle">Ширина суток</span>
            <span className="font-mono text-sm font-medium tabular-nums">
              {data.medianWidth24 == null ? "—" : formatPctAbs(data.medianWidth24)}
            </span>
            <span className="mt-0.5 block text-xs text-muted">медиана</span>
          </p>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-subtle">
          Считаем коридор так, будто открыли приложение в тот день, и смотрим, где цена закрылась через сутки. Это не дневник выданных заранее прогнозов.
          История ~{Math.round(data.hours / 24)} дней часовиков.
          {data.empiricalReady
            ? " Длины хватает, чтобы живой коридор мог взять квантили того же режима."
            : " Часовиков мало — живой коридор часто остаётся гауссовым."}
        </p>
      </section>

      <section className="mt-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="text-base font-semibold">Последние окна</h2>
        <p className="mt-1 text-xs text-muted">Цена тогда, коридор на сутки, факт через 24 часа.</p>
        <ul className="mt-4 space-y-3">
          {data.rows.map((r) => (
            <li key={r.ts} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs text-subtle">{formatTime(new Date(r.ts).toISOString())}</p>
                <p
                  className={cn(
                    "text-xs font-medium",
                    r.hit24 ? "text-ok" : "text-event",
                  )}
                >
                  {r.hit24 ? "попал" : "мимо"}
                </p>
              </div>
              <p className="mt-1 font-mono text-sm tabular-nums">
                {formatPrice(r.low24, dec)} — {formatPrice(r.high24, dec)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                было {formatPrice(r.price, dec)}
                {r.fact24 != null ? ` · факт ${formatPrice(r.fact24, dec)}` : ""}
                {" · "}
                {formatPctAbs(r.width24)}
                {r.fact24 != null && r.price > 0
                  ? ` · ход ${formatPct((r.fact24 - r.price) / r.price)}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

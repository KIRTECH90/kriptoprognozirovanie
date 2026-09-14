import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { ASSETS, getAsset, getQuote, quotesFor } from "@/lib/markets.ts";
import { cn } from "@/lib/utils.ts";

type Open = "asset" | "quote" | null;

export function MarketPicker({
  asset,
  quote,
  onAsset,
  onQuote,
}: {
  asset: string;
  quote: string;
  onAsset: (id: string) => void;
  onQuote: (id: string) => void;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [query, setQuery] = useState("");
  const lockUntil = useRef(0);
  const meta = getAsset(asset);
  const qMeta = getQuote(quote);
  const quotes = quotesFor(asset);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ASSETS;
    return ASSETS.filter((a) => a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [query]);

  function armed() {
    return Date.now() < lockUntil.current;
  }

  function toggle(next: Open) {
    if (armed()) return;
    setOpen((cur) => (cur === next ? null : next));
    if (next !== "asset") setQuery("");
  }

  function pickAsset(id: string) {
    lockUntil.current = Date.now() + 450;
    setOpen(null);
    setQuery("");
    if (id !== asset) onAsset(id);
  }

  function pickQuote(id: string) {
    lockUntil.current = Date.now() + 450;
    setOpen(null);
    if (id !== quote) onQuote(id);
  }

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <button
          type="button"
          aria-expanded={open === "asset"}
          aria-haspopup="listbox"
          onClick={() => toggle("asset")}
          className={cn(
            "flex min-h-16 flex-col items-start justify-center rounded-[var(--radius-lg)] bg-surface px-4 py-3 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 ease-out active:scale-[0.99]",
            open === "asset" && "shadow-[var(--shadow-border-hover)]",
          )}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-subtle">Монета</span>
          <span className="mt-0.5 flex w-full items-center justify-between gap-2">
            <span className="truncate text-base font-semibold">{meta.name}</span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted transition-transform duration-150", open === "asset" && "rotate-180")}
            />
          </span>
          <span className="text-sm text-muted">{meta.id}</span>
        </button>
        <button
          type="button"
          aria-expanded={open === "quote"}
          aria-haspopup="listbox"
          onClick={() => toggle("quote")}
          className={cn(
            "flex min-h-16 min-w-28 flex-col items-start justify-center rounded-[var(--radius-lg)] bg-surface px-4 py-3 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 ease-out active:scale-[0.99]",
            open === "quote" && "shadow-[var(--shadow-border-hover)]",
          )}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-subtle">Цена в</span>
          <span className="mt-0.5 flex w-full items-center justify-between gap-2">
            <span className="text-base font-semibold">{qMeta.label}</span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted transition-transform duration-150", open === "quote" && "rotate-180")}
            />
          </span>
          <span className="text-sm text-muted">{qMeta.hint}</span>
        </button>
      </div>

      {open === "asset" ? (
        <div className="mt-2 overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
          <label className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти монету"
              className="h-10 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
            />
          </label>
          <ul className="max-h-80 overflow-y-auto overscroll-contain p-1" role="listbox" aria-label="Монеты">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-muted">Ничего не нашлось</li>
            ) : (
              filtered.map((a) => {
                const on = a.id === asset;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        pickAsset(a.id);
                      }}
                      className={cn(
                        "flex h-12 w-full items-center justify-between rounded-[var(--radius-sm)] px-3 text-left text-sm transition-colors duration-150",
                        on ? "bg-fg text-bg" : "text-fg hover:bg-bg-elevated",
                      )}
                    >
                      <span className="font-medium">{a.name}</span>
                      <span className={cn("flex items-center gap-2", on ? "text-bg/70" : "text-muted")}>
                        {a.id}
                        {on ? <Check className="size-4" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}

      {open === "quote" ? (
        <ul
          className="mt-2 overflow-hidden rounded-[var(--radius-lg)] bg-surface p-1 shadow-[var(--shadow-border)]"
          role="listbox"
          aria-label="Котировки"
        >
          {quotes.map((q) => {
            const on = q.id === quote;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pickQuote(q.id);
                  }}
                  className={cn(
                    "flex h-12 w-full items-center justify-between rounded-[var(--radius-sm)] px-3 text-left text-sm transition-colors duration-150",
                    on ? "bg-fg text-bg" : "text-fg hover:bg-bg-elevated",
                  )}
                >
                  <span className="font-medium">{q.label}</span>
                  <span className={cn("flex items-center gap-2", on ? "text-bg/70" : "text-muted")}>
                    {q.hint}
                    {on ? <Check className="size-4" /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

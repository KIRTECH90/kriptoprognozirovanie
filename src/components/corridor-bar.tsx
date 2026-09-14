import { cn } from "@/lib/utils.ts";

type Props = {
  price: number;
  low: number;
  high: number;
  expected: number;
  domainMin?: number;
  domainMax?: number;
  accent?: "accent" | "event";
};

export function CorridorBar({
  price,
  low,
  high,
  expected,
  domainMin,
  domainMax,
  accent = "accent",
}: Props) {
  const min = domainMin ?? Math.min(low, price, expected);
  const max = domainMax ?? Math.max(high, price, expected);
  const span = max - min || 1;
  const x = (v: number) => `${((v - min) / span) * 100}%`;
  const left = ((low - min) / span) * 100;
  const width = ((high - low) / span) * 100;
  const fill = accent === "event" ? "bg-event" : "bg-range";
  const split = Math.abs(expected - price) / span > 0.03;

  return (
    <div className="relative h-9">
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-track" />
      <div
        className={cn("absolute top-1/2 h-2 -translate-y-1/2 rounded-full", fill)}
        style={{ left: `${left}%`, width: `${Math.max(width, 1.2)}%` }}
      />
      {split ? (
        <div
          className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: x(expected) }}
          title="Ориентир"
        />
      ) : null}
      <div
        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg ring-2 ring-bg"
        style={{ left: x(price) }}
        title="Сейчас"
      />
    </div>
  );
}

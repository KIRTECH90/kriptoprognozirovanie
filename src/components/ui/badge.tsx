import { cn } from "@/lib/utils.ts";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "ok" | "warn" | "event" | "accent";
}) {
  const tones = {
    neutral: "bg-track text-fg",
    ok: "bg-ok/10 text-ok",
    warn: "bg-warn/10 text-warn",
    event: "bg-event/10 text-event",
    accent: "bg-accent/10 text-accent",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

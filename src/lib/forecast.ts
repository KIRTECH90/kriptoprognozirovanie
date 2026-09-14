import { createServerFn } from "@tanstack/react-start";
import type { JournalPayload } from "@/lib/corridor/journal.ts";
import type { ForecastBundle } from "@/lib/corridor/types.ts";

export const getForecastFn = createServerFn({ method: "POST" })
  .validator((d: { refresh?: boolean; symbol?: string } | undefined) => d ?? {})
  .handler(async ({ data }): Promise<ForecastBundle> => {
    const { buildForecast } = await import("@/lib/corridor/run.server.ts");
    return buildForecast({
      forceRefresh: Boolean(data?.refresh),
      symbol: data?.symbol,
    });
  });

export const getJournalFn = createServerFn({ method: "POST" })
  .validator((d: { symbol?: string } | undefined) => d ?? {})
  .handler(async ({ data }): Promise<JournalPayload> => {
    const { buildJournal } = await import("@/lib/corridor/run.server.ts");
    return buildJournal((data?.symbol ?? "BTCUSDT").toUpperCase());
  });

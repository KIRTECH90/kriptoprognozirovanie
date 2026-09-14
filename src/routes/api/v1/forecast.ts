import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/forecast")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const symbol = (url.searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();
        const { isKnownSymbol } = await import("@/lib/markets");
        if (!isKnownSymbol(symbol)) {
          return Response.json({ error: "Unknown pair" }, { status: 400 });
        }
        const { buildForecastApi } = await import("@/lib/corridor/run.server");
        try {
          const body = await buildForecastApi(symbol, url.searchParams.get("refresh") === "1");
          return Response.json(body);
        } catch {
          return Response.json({ error: "Pair unavailable" }, { status: 502 });
        }
      },
    },
  },
});

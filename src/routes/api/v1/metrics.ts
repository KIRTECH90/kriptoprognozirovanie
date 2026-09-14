import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/metrics")({
  server: {
    handlers: {
      GET: async () => {
        const { metricsPayload } = await import("@/lib/corridor/run.server");
        return Response.json(metricsPayload());
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/health")({
  server: {
    handlers: {
      GET: async () => {
        const { healthPayload } = await import("@/lib/corridor/run.server");
        return Response.json(healthPayload());
      },
    },
  },
});

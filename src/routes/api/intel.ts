import { createFileRoute } from "@tanstack/react-router";
import { collectAll } from "@/lib/intel/collect";
import type { TrackKind } from "@/lib/intel/types";

export const Route = createFileRoute("/api/intel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const raw = url.searchParams.get("only");
        const only =
          raw === "gold" || raw === "gpu" || raw === "macmini" ? (raw as TrackKind) : undefined;
        const data = await collectAll(only);
        return Response.json(data, {
          headers: {
            "cache-control": "public, max-age=60",
          },
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { collectAll } from "@/lib/intel/collect";
import { bundledSnapshot } from "@/lib/intel/snapshot";
import type { TrackKind } from "@/lib/intel/types";

export const Route = createFileRoute("/api/intel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const raw = url.searchParams.get("only");
        const only =
          raw === "gold" || raw === "gpu" || raw === "macmini" ? (raw as TrackKind) : undefined;
        try {
          const data = await collectAll(only);
          return Response.json(data, {
            headers: { "cache-control": "public, max-age=60" },
          });
        } catch (err) {
          const fallback = bundledSnapshot();
          fallback.warnings = [
            ...fallback.warnings,
            `Live collect failed: ${(err as Error).message}`,
          ];
          return Response.json(fallback, {
            status: 200,
            headers: { "cache-control": "public, max-age=30" },
          });
        }
      },
    },
  },
});

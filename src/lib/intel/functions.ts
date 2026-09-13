import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { collectAll } from "./collect.ts";
import type { IntelBundle, TrackKind } from "./types.ts";

const CACHE_MS = 60_000;
let cached: { at: number; data: IntelBundle } | null = null;

const inputSchema = z.object({
  only: z.enum(["gold", "gpu", "macmini"]).optional(),
  force: z.boolean().optional(),
});

export const fetchIntel = createServerFn({ method: "GET" })
  .validator(inputSchema)
  .handler(async ({ data }): Promise<IntelBundle> => {
    const only = data.only as TrackKind | undefined;
    const force = data.force === true;
    if (!only && !force && cached && Date.now() - cached.at < CACHE_MS) {
      return cached.data;
    }
    const bundle = await collectAll(only);
    if (!only) cached = { at: Date.now(), data: bundle };
    return bundle;
  });

import { getJson } from "./http.ts";
import type { IntelBundle, Quote, TrackKind } from "./types.ts";
import bundled from "./fallback.json" with { type: "json" };

const RAW_URL =
  "https://raw.githubusercontent.com/zmt18928708528-eng/intel-hub/main/data/latest.json";

function asBundle(raw: unknown): IntelBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<IntelBundle>;
  if (!Array.isArray(data.gold) || !Array.isArray(data.gpu) || !Array.isArray(data.macmini)) {
    return null;
  }
  return {
    asOf: typeof data.asOf === "string" ? data.asOf : new Date().toISOString(),
    gold: data.gold,
    gpu: data.gpu,
    macmini: data.macmini,
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
  };
}

export function bundledSnapshot(): IntelBundle {
  return structuredClone(asBundle(bundled) ?? emptyBundle());
}

export function emptyBundle(): IntelBundle {
  return {
    asOf: new Date().toISOString(),
    gold: [],
    gpu: [],
    macmini: [],
    warnings: [],
  };
}

export async function loadRemoteSnapshot(): Promise<IntelBundle | null> {
  try {
    return asBundle(await getJson<unknown>(RAW_URL, {}, 2_500));
  } catch {
    return null;
  }
}

function identity(q: Quote): string {
  const ticker = q.source.match(/^(yahoo|nasdaq|stooq):(.+)$/);
  if (ticker) return `${q.kind}:sym:${ticker[2].replace(/=F$/i, "")}`;
  if (typeof q.extra?.watchModel === "string" && q.extra.watchModel) {
    return `${q.kind}:${q.source}:${q.extra.watchModel}`;
  }
  return `${q.kind}:${q.source}`;
}

function markSnapshot(quotes: Quote[]): Quote[] {
  return quotes.map((q) => ({
    ...q,
    extra: { ...(q.extra ?? {}), fromSnapshot: true },
  }));
}

export function mergeSnapshot(live: IntelBundle, snap: IntelBundle, only?: TrackKind): IntelBundle {
  const merge = (a: Quote[], b: Quote[]) => {
    const keys = new Set(a.map(identity));
    return [...a, ...markSnapshot(b.filter((q) => !keys.has(identity(q))))];
  };
  return {
    asOf: live.asOf,
    gold: !only || only === "gold" ? merge(live.gold, snap.gold) : live.gold,
    gpu: !only || only === "gpu" ? merge(live.gpu, snap.gpu) : live.gpu,
    macmini: !only || only === "macmini" ? merge(live.macmini, snap.macmini) : live.macmini,
    warnings: [...live.warnings],
  };
}

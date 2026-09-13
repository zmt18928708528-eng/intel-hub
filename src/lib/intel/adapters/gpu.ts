import { getJson, nowIso } from "../http.ts";
import type { Quote } from "../types.ts";
import { yahooQuote } from "../yahoo.ts";

const WATCH_MODELS = ["RTX5090", "RTX5080", "RTX5070", "RTX4090", "H100", "B200", "A100", "RTX6000"];

interface GpuRow {
  provider?: string;
  model?: string;
  gpuCount?: number;
  vram?: number;
  pricePerHour?: number;
  region?: string;
  availability?: string;
  link?: string;
  lastUpdated?: string;
}

interface GpuTrackerFile {
  lastUpdated?: string;
  data?: GpuRow[];
}

interface NvidiaSearch {
  searchedProducts?: {
    productDetails?: Array<{
      displayName?: string;
      productSKU?: string;
      productPrice?: string;
      manufacturer?: string;
      internalLink?: string;
    }>;
  };
}

interface RunpodPayload {
  data?: {
    gpuTypes?: Array<{
      id?: string;
      displayName?: string;
      memoryInGb?: number;
      lowestPrice?: { uninterruptablePrice?: number | null };
    }>;
  };
}

function normalizeModel(name: string): string {
  return name.replace(/\s+/g, "").toUpperCase();
}

function pickCheapest(rows: GpuRow[], model: string): GpuRow | undefined {
  const needle = normalizeModel(model);
  return rows
    .filter((r) => normalizeModel(r.model ?? "").includes(needle) && typeof r.pricePerHour === "number")
    .sort((a, b) => (a.pricePerHour ?? 99) - (b.pricePerHour ?? 99))[0];
}

async function cloudGpuQuotes(): Promise<Quote[]> {
  const payload = await getJson<GpuTrackerFile>("https://gputracker.dev/gpu-data.json", {}, 10_000);
  const rows = payload.data ?? [];
  const quotes: Quote[] = [];
  for (const model of WATCH_MODELS) {
    const row = pickCheapest(rows, model);
    if (!row) continue;
    quotes.push({
      kind: "gpu",
      title: `${row.model} cloud rental · ${row.provider}`,
      price: row.pricePerHour ?? null,
      currency: "USD",
      unit: "GPU-hour",
      inStock: (row.availability ?? "").toLowerCase() !== "low" ? true : null,
      vendor: row.provider ?? "gputracker",
      source: "gputracker.dev",
      url: row.link,
      extra: {
        region: row.region ?? "",
        vram: row.vram ?? null,
        gpuCount: row.gpuCount ?? null,
        availability: row.availability ?? "",
        watchModel: model,
      },
      asOf: row.lastUpdated ?? payload.lastUpdated ?? nowIso(),
    });
  }
  return quotes;
}

async function runpodQuotes(): Promise<Quote[]> {
  const payload = await getJson<RunpodPayload>(
    "https://api.runpod.io/graphql",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query:
          "{ gpuTypes { id displayName memoryInGb lowestPrice { uninterruptablePrice } } }",
      }),
    },
    10_000,
  );
  const types = payload.data?.gpuTypes ?? [];
  const quotes: Quote[] = [];
  for (const model of WATCH_MODELS) {
    const needle = model.replace("RTX", "RTX ");
    const matches = types
      .filter((t) => {
        const name = normalizeModel(`${t.displayName ?? ""} ${t.id ?? ""}`);
        return name.includes(model) || name.includes(normalizeModel(needle));
      })
      .filter((t) => typeof t.lowestPrice?.uninterruptablePrice === "number")
      .sort(
        (a, b) =>
          (a.lowestPrice?.uninterruptablePrice ?? 99) - (b.lowestPrice?.uninterruptablePrice ?? 99),
      );
    const row = matches[0];
    if (!row) continue;
    quotes.push({
      kind: "gpu",
      title: `${row.displayName} cloud rental · RunPod`,
      price: row.lowestPrice?.uninterruptablePrice ?? null,
      currency: "USD",
      unit: "GPU-hour",
      inStock: true,
      vendor: "RunPod",
      source: "runpod:graphql",
      url: "https://www.runpod.io/gpu-instance/pricing",
      extra: {
        vram: row.memoryInGb ?? null,
        watchModel: model,
      },
      asOf: nowIso(),
    });
  }
  return quotes;
}

function parsePrice(raw?: string): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function nvidiaRetailQuotes(): Promise<Quote[]> {
  const locale = process.env.NVIDIA_LOCALE ?? "en-us";
  const data = await getJson<NvidiaSearch>(
    `https://api.nvidia.partners/edge/product/search?page=1&limit=12&locale=${locale}&category=GPU`,
    {},
    8_000,
  );
  const details = data.searchedProducts?.productDetails ?? [];
  return details
    .filter((p) => (p.manufacturer ?? "NVIDIA") === "NVIDIA")
    .map((p) => ({
      kind: "gpu" as const,
      title: p.displayName ?? "NVIDIA GPU",
      price: parsePrice(p.productPrice),
      currency: "USD",
      unit: "card",
      vendor: "NVIDIA Marketplace",
      source: "api.nvidia.partners",
      url: p.internalLink,
      extra: { sku: p.productSKU ?? "" },
      note: "Founders Edition / partner catalog.",
      asOf: nowIso(),
    }));
}

export async function collectGpu(): Promise<{ quotes: Quote[]; warnings: string[] }> {
  const quotes: Quote[] = [];
  const warnings: string[] = [];

  try {
    quotes.push(...(await cloudGpuQuotes()));
  } catch (err) {
    warnings.push(`gputracker.dev failed: ${(err as Error).message}`);
  }

  if (!quotes.some((q) => q.source === "gputracker.dev")) {
    try {
      quotes.push(...(await runpodQuotes()));
    } catch (err) {
      warnings.push(`RunPod GPU list failed: ${(err as Error).message}`);
    }
  }

  try {
    quotes.push(...(await nvidiaRetailQuotes()));
  } catch (err) {
    warnings.push(`NVIDIA partner API failed: ${(err as Error).message}`);
  }

  try {
    quotes.push(
      await yahooQuote({
        symbol: "NVDA",
        kind: "gpu",
        title: "NVDA (GPU market proxy)",
        unit: "share",
        note: "Not a card price. Useful as sector sentiment.",
      }),
    );
  } catch (err) {
    warnings.push(`NVDA proxy failed: ${(err as Error).message}`);
  }

  return { quotes, warnings };
}

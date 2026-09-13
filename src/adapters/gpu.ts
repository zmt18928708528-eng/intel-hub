import { getJson, nowIso } from "../http.ts";
import type { Quote } from "../types.ts";

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
  const payload = await getJson<GpuTrackerFile>("https://gputracker.dev/gpu-data.json", {}, 25_000);
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
      },
      asOf: row.lastUpdated ?? payload.lastUpdated ?? nowIso(),
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
    10_000,
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
      note: "Founders Edition / partner catalog. Inventory detail: api.store.nvidia.com/partner/v1/feinventory",
      asOf: nowIso(),
    }));
}

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        regularMarketChangePercent?: number;
        currency?: string;
        shortName?: string;
        regularMarketTime?: number;
      };
    }>;
  };
}

async function nvdaProxy(): Promise<Quote> {
  const data = await getJson<YahooChart>(
    "https://query1.finance.yahoo.com/v8/finance/chart/NVDA?interval=1d&range=5d",
  );
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error("NVDA quote missing");
  return {
    kind: "gpu",
    title: "NVDA (GPU market proxy)",
    price: meta.regularMarketPrice,
    currency: meta.currency ?? "USD",
    unit: "share",
    changePct: meta.regularMarketChangePercent ?? null,
    vendor: "Yahoo Finance",
    source: "yahoo:NVDA",
    url: "https://finance.yahoo.com/quote/NVDA",
    note: "Not a card price. Useful as sector sentiment.",
    asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : nowIso(),
  };
}

export async function collectGpu(): Promise<{ quotes: Quote[]; warnings: string[] }> {
  const quotes: Quote[] = [];
  const warnings: string[] = [];

  try {
    quotes.push(...(await cloudGpuQuotes()));
  } catch (err) {
    warnings.push(`gputracker.dev failed: ${(err as Error).message}`);
  }

  try {
    quotes.push(...(await nvidiaRetailQuotes()));
  } catch (err) {
    warnings.push(`NVIDIA partner API failed: ${(err as Error).message}`);
  }

  try {
    quotes.push(await nvdaProxy());
  } catch (err) {
    warnings.push(`NVDA proxy failed: ${(err as Error).message}`);
  }

  return { quotes, warnings };
}

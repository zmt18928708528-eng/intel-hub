import { getJson, nowIso } from "../http.ts";
import type { Quote } from "../types.ts";

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        regularMarketPrice?: number;
        regularMarketChangePercent?: number;
        currency?: string;
        regularMarketTime?: number;
      };
    }>;
    error?: { description?: string };
  };
}

interface CurrencyPayload {
  date?: string;
  usd?: Record<string, number>;
}

function yahooUrl(symbol: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
}

async function yahooQuote(symbol: string, title: string, unit: string): Promise<Quote> {
  const data = await getJson<YahooChart>(yahooUrl(symbol));
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error(`Yahoo missing price for ${symbol}`);
  const asOf = meta.regularMarketTime
    ? new Date(meta.regularMarketTime * 1000).toISOString()
    : nowIso();
  return {
    kind: "gold",
    title,
    price: meta.regularMarketPrice,
    currency: meta.currency ?? "USD",
    unit,
    changePct: meta.regularMarketChangePercent ?? null,
    vendor: "Yahoo Finance",
    source: `yahoo:${symbol}`,
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    asOf,
  };
}

async function spotFromCurrencyApi(): Promise<Quote> {
  const data = await getJson<CurrencyPayload>(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
  );
  const xau = data.usd?.xau;
  const cny = data.usd?.cny;
  if (!xau) throw new Error("currency-api missing usd.xau");
  const usdPerOz = 1 / xau;
  return {
    kind: "gold",
    title: "Gold spot (derived from USD/XAU)",
    price: Number(usdPerOz.toFixed(2)),
    currency: "USD",
    unit: "oz",
    vendor: "fawazahmed0/exchange-api",
    source: "currency-api:usd.xau",
    url: "https://github.com/fawazahmed0/exchange-api",
    extra: {
      usdCny: cny ?? null,
      cnyPerGramApprox: cny ? Number(((usdPerOz / 31.1034768) * cny).toFixed(2)) : null,
    },
    note: "Daily FX table, not tick-level COMEX.",
    asOf: data.date ? `${data.date}T00:00:00.000Z` : nowIso(),
  };
}

async function optionalGoldApi(): Promise<Quote | null> {
  const key = process.env.GOLDAPI_KEY;
  if (!key) return null;
  const data = await getJson<{
    price?: number;
    chp?: number;
    currency?: string;
    metal?: string;
  }>("https://www.goldapi.io/api/XAU/USD", {
    headers: { "x-access-token": key, "Content-Type": "application/json" },
  });
  if (!data.price) throw new Error("GoldAPI returned no price");
  return {
    kind: "gold",
    title: "Gold spot XAU/USD",
    price: data.price,
    currency: data.currency ?? "USD",
    unit: "oz",
    changePct: data.chp ?? null,
    vendor: "GoldAPI.io",
    source: "goldapi:XAU/USD",
    url: "https://www.goldapi.io",
    note: "Optional paid/free-key path. Also has official MCP: @goldapi/mcp-server",
    asOf: nowIso(),
  };
}

export async function collectGold(): Promise<{ quotes: Quote[]; warnings: string[] }> {
  const quotes: Quote[] = [];
  const warnings: string[] = [];

  try {
    quotes.push(await yahooQuote("GC=F", "COMEX Gold futures", "oz"));
  } catch (err) {
    warnings.push(`Yahoo GC=F failed: ${(err as Error).message}`);
  }

  try {
    quotes.push(await spotFromCurrencyApi());
  } catch (err) {
    warnings.push(`currency-api failed: ${(err as Error).message}`);
  }

  try {
    const extra = await optionalGoldApi();
    if (extra) quotes.push(extra);
  } catch (err) {
    warnings.push(`GoldAPI optional path failed: ${(err as Error).message}`);
  }

  return { quotes, warnings };
}

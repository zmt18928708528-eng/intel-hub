import { finiteNumbers, getJson, nowIso } from "../http.ts";
import type { Quote } from "../types.ts";
import { yahooQuote } from "../yahoo.ts";

interface CurrencyPayload {
  date?: string;
  usd?: Record<string, number>;
}

async function paxgSpark(): Promise<number[]> {
  const data = await getJson<{ prices?: Array<[number, number]> }>(
    "https://api.coingecko.com/api/v3/coins/pax-gold/market_chart?vs_currency=usd&days=30&interval=daily",
    {},
    8_000,
  );
  return finiteNumbers((data.prices ?? []).map((p) => p[1]));
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

async function spotFromGoldApiCom(): Promise<Quote> {
  const data = await getJson<{ price?: number; updatedAt?: string }>(
    "https://api.gold-api.com/price/XAU",
    {},
    8_000,
  );
  if (!data.price) throw new Error("gold-api.com returned no price");
  let spark: number[] = [];
  try {
    spark = await paxgSpark();
  } catch {
    /* optional */
  }
  return {
    kind: "gold",
    title: "Gold spot XAU/USD",
    price: data.price,
    currency: "USD",
    unit: "oz",
    vendor: "gold-api.com",
    source: "gold-api.com:XAU",
    url: "https://gold-api.com",
    spark,
    asOf: data.updatedAt ?? nowIso(),
  };
}

async function optionalGoldApi(): Promise<Quote | null> {
  const key = process.env.GOLDAPI_KEY;
  if (!key) return null;
  const data = await getJson<{
    price?: number;
    chp?: number;
    currency?: string;
  }>("https://www.goldapi.io/api/XAU/USD", {
    headers: { "x-access-token": key, "Content-Type": "application/json" },
  });
  if (!data.price) throw new Error("GoldAPI returned no price");
  return {
    kind: "gold",
    title: "Gold spot XAU/USD (GoldAPI.io)",
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
    quotes.push(
      await yahooQuote({
        symbol: "GC=F",
        kind: "gold",
        title: "COMEX Gold futures",
        unit: "oz",
      }),
    );
  } catch (err) {
    warnings.push(`COMEX GC=F failed: ${(err as Error).message}`);
  }

  try {
    quotes.push(await spotFromGoldApiCom());
  } catch (err) {
    warnings.push(`gold-api.com failed: ${(err as Error).message}`);
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

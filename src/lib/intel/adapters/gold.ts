import { finiteNumbers, getJson, nowIso, settled } from "../http.ts";
import { stooqQuote } from "../stooq.ts";
import type { Quote } from "../types.ts";
import { yahooQuote } from "../yahoo.ts";

interface CurrencyPayload {
  date?: string;
  usd?: Record<string, number>;
}

async function paxgQuote(): Promise<Quote> {
  const data = await getJson<{
    "pax-gold"?: { usd?: number; usd_24h_change?: number };
  }>(
    "https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true",
  );
  const row = data["pax-gold"];
  if (!row?.usd) throw new Error("CoinGecko missing pax-gold");
  let spark: number[] = [];
  try {
    const chart = await getJson<{ prices?: Array<[number, number]> }>(
      "https://api.coingecko.com/api/v3/coins/pax-gold/market_chart?vs_currency=usd&days=30&interval=daily",
    );
    spark = finiteNumbers((chart.prices ?? []).map((p) => p[1]));
  } catch {
    /* optional */
  }
  return {
    kind: "gold",
    title: "PAXG (tokenized gold)",
    price: row.usd,
    currency: "USD",
    unit: "oz",
    changePct: row.usd_24h_change ?? null,
    vendor: "CoinGecko",
    source: "coingecko:pax-gold",
    url: "https://www.coingecko.com/en/coins/pax-gold",
    spark,
    note: "On-chain gold proxy, not COMEX.",
    asOf: nowIso(),
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

async function spotFromGoldApiCom(): Promise<Quote> {
  const data = await getJson<{ price?: number; updatedAt?: string }>(
    "https://api.gold-api.com/price/XAU",
  );
  if (!data.price) throw new Error("gold-api.com returned no price");
  return {
    kind: "gold",
    title: "Gold spot XAU/USD",
    price: data.price,
    currency: "USD",
    unit: "oz",
    vendor: "gold-api.com",
    source: "gold-api.com:XAU",
    url: "https://gold-api.com",
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
    note: "Optional paid/free-key path.",
    asOf: nowIso(),
  };
}

const OPTIONAL_PREFIXES = ["Stooq", "GoldAPI optional", "PAXG"];

function attachCny(quotes: Quote[]) {
  const cny = quotes.find((q) => typeof q.extra?.usdCny === "number")?.extra?.usdCny;
  if (typeof cny !== "number") return;
  for (const q of quotes) {
    if (q.price == null) continue;
    q.extra = {
      ...(q.extra ?? {}),
      usdCny: cny,
      cnyPerGramApprox:
        typeof q.extra?.cnyPerGramApprox === "number"
          ? q.extra.cnyPerGramApprox
          : Number(((q.price / 31.1034768) * cny).toFixed(2)),
    };
  }
}

export async function collectGold(): Promise<{ quotes: Quote[]; warnings: string[] }> {
  const quotes: Quote[] = [];
  const warnings: string[] = [];

  const jobs = await Promise.all([
    settled(
      "COMEX GC=F",
      yahooQuote({
        symbol: "GC=F",
        kind: "gold",
        title: "COMEX Gold futures",
        unit: "oz",
      }),
    ),
    settled(
      "Stooq XAUUSD",
      stooqQuote({
        symbol: "xauusd",
        kind: "gold",
        title: "Gold spot XAU/USD",
        unit: "oz",
        note: "Stooq 现货后备。",
      }),
    ),
    settled("gold-api.com", spotFromGoldApiCom()),
    settled("currency-api", spotFromCurrencyApi()),
    settled("PAXG", paxgQuote()),
    settled("GoldAPI optional", optionalGoldApi()),
  ]);

  for (const job of jobs) {
    if (!job.ok) {
      if (!OPTIONAL_PREFIXES.some((p) => job.error.startsWith(p))) warnings.push(job.error);
      continue;
    }
    if (job.value) quotes.push(job.value);
  }

  const spark = quotes.find((q) => (q.spark?.length ?? 0) > 1)?.spark;
  if (spark) {
    for (const q of quotes) {
      if (!q.spark || q.spark.length < 2) q.spark = spark;
    }
  }

  const seen = new Set<string>();
  const deduped = quotes.filter((q) => {
    const key = `${q.source}:${q.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  attachCny(deduped);
  return { quotes: deduped, warnings };
}

const DEFAULT_UA = "Mozilla/5.0";

export const FETCH_MS = 4_000;

export async function getJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = FETCH_MS,
): Promise<T> {
  const res = await request(url, init, timeoutMs);
  return (await res.json()) as T;
}

export async function getText(url: string, timeoutMs = FETCH_MS): Promise<string> {
  const res = await request(
    url,
    {
      headers: {
        Accept: "text/html,text/csv,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    },
    timeoutMs,
  );
  return await res.text();
}

async function request(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Accept: "*/*",
        "User-Agent": DEFAULT_UA,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function finiteNumbers(values: Array<number | null | undefined>): number[] {
  return values.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
}

export async function settled<T>(
  label: string,
  job: Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await job };
  } catch (err) {
    return { ok: false, error: `${label}: ${(err as Error).message}` };
  }
}

export function isStale(iso?: string | null, maxAgeMs = 3 * 24 * 60 * 60 * 1000): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t > maxAgeMs;
}

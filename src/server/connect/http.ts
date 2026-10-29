/** Shared helper for calling external APIs: a timeout, JSON in and out, and errors that name the service. */
export class ConnectorError extends Error {
  constructor(
    public service: string,
    message: string,
    public status?: number,
  ) {
    super(`${service}: ${message}`);
  }
}

export async function callJson<T>(service: string, url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 15_000, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new ConnectorError(service, `request failed (${e instanceof Error ? e.message : "network error"})`);
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === "object" && body && "message" in body ? String((body as { message: unknown }).message) : `HTTP ${res.status}`;
    throw new ConnectorError(service, msg, res.status);
  }
  return body as T;
}

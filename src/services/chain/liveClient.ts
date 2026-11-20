import { z } from 'zod';
import { sleep } from '@/lib/utils';

/**
 * Read-only client for a Cosmos REST (LCD) endpoint — the first building block of a Live provider.
 *
 * What it guarantees (and what the tests cover):
 *  - every response is validated with Zod before any value is used; unexpected shapes are errors, never guesses
 *  - requests time out, are spaced out (a minimum interval between calls) and never send credentials
 *  - missing optional data makes a result `partial`, it does not fail the whole call
 *  - nothing here ever falls back to simulated data: a failure is reported as a failure
 *
 * Only a connection probe is wired into the app (Settings → Test connection). The rest of the Live provider
 * (blocks, validators, proposals …) is not implemented yet and the app says so rather than faking it.
 */

export type LiveErrorKind = 'timeout' | 'network' | 'http' | 'invalid';

export class LiveRequestError extends Error {
  readonly kind: LiveErrorKind;
  readonly status?: number;
  constructor(kind: LiveErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'LiveRequestError';
    this.kind = kind;
    this.status = status;
  }
}

/** Thrown by a provider method the live adapter does not implement (instead of returning demo data). */
export class UnsupportedFeatureError extends Error {
  constructor(feature: string) {
    super(`"${feature}" is not available from the live provider yet`);
    this.name = 'UnsupportedFeatureError';
  }
}

const nodeInfoSchema = z.object({
  default_node_info: z.object({ network: z.string().min(1).max(64), version: z.string().max(64).optional() }),
});
const latestBlockSchema = z.object({
  block: z.object({
    header: z.object({
      chain_id: z.string().min(1).max(64),
      height: z.string().regex(/^[1-9]\d{0,15}$/),
      time: z.string().refine((s) => Number.isFinite(Date.parse(s)), 'not a timestamp'),
    }),
  }),
});

export interface LiveConnection {
  chainId: string;
  height: number;
  blockTime: number;
  latencyMs: number;
  nodeVersion?: string;
  /** True when an optional part (the node info) could not be read. */
  partial: boolean;
}

export interface LiveClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  /** Minimum gap between two requests, in ms (a simple client-side rate limit). */
  minIntervalMs?: number;
  fetchFn?: typeof fetch;
}

export function createLiveClient({ baseUrl, timeoutMs = 8_000, minIntervalMs = 250, fetchFn }: LiveClientOptions) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))) {
    throw new LiveRequestError('invalid', 'The endpoint must use https (or http on localhost).');
  }
  const root = url.toString().replace(/\/+$/, '');
  const doFetch: typeof fetch = fetchFn ?? ((input, init) => fetch(input, init));
  let lastRequestAt = 0;

  async function getJson<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>> {
    const wait = lastRequestAt + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await doFetch(root + path, { signal: controller.signal, headers: { accept: 'application/json' }, credentials: 'omit', cache: 'no-store' });
    } catch (e) {
      throw controller.signal.aborted ? new LiveRequestError('timeout', `No answer within ${timeoutMs} ms`) : new LiveRequestError('network', e instanceof Error ? e.message : 'Network error');
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new LiveRequestError('http', `HTTP ${response.status}`, response.status);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new LiveRequestError('invalid', 'The response was not JSON');
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new LiveRequestError('invalid', 'The response did not have the expected shape');
    return parsed.data;
  }

  /** Reads the latest block (required) and the node version (optional). */
  async function probe(): Promise<LiveConnection> {
    const started = Date.now();
    const latest = await getJson('/cosmos/base/tendermint/v1beta1/blocks/latest', latestBlockSchema);
    const latencyMs = Date.now() - started;
    let nodeVersion: string | undefined;
    let partial = false;
    try {
      nodeVersion = (await getJson('/cosmos/base/tendermint/v1beta1/node_info', nodeInfoSchema)).default_node_info.version;
    } catch {
      partial = true;
    }
    const { chain_id, height, time } = latest.block.header;
    return { chainId: chain_id, height: Number(height), blockTime: Date.parse(time), latencyMs, nodeVersion, partial };
  }

  return { probe, getJson };
}

import { describe, expect, it, vi } from 'vitest';
import { LiveRequestError, createLiveClient } from './liveClient';

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const latest = { block: { header: { chain_id: 'testhub-1', height: '1234567', time: '2026-11-18T08:00:00Z' } } };
const nodeInfo = { default_node_info: { network: 'testhub-1', version: '0.38.9' } };
const asFetch = (fn: unknown): typeof fetch => fn as typeof fetch;
const make = (fetchFn: typeof fetch, extra: object = {}) => createLiveClient({ baseUrl: 'https://rest.example.test/', fetchFn, minIntervalMs: 0, ...extra });

describe('live (Cosmos REST) client', () => {
  it('reads the latest block and the node version, without credentials or caching', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => (String(input).endsWith('/blocks/latest') ? json(latest) : json(nodeInfo)));
    const c = await make(asFetch(fetchFn)).probe();
    expect(c).toMatchObject({ chainId: 'testhub-1', height: 1234567, blockTime: Date.parse('2026-11-18T08:00:00Z'), nodeVersion: '0.38.9', partial: false });
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://rest.example.test/cosmos/base/tendermint/v1beta1/blocks/latest');
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit', cache: 'no-store' });
  });

  it('returns partial data when only the optional node info is unavailable', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => (String(input).endsWith('/blocks/latest') ? json(latest) : json({ message: 'nope' }, 501)));
    const c = await make(asFetch(fetchFn)).probe();
    expect(c.partial).toBe(true);
    expect(c.nodeVersion).toBeUndefined();
    expect(c.height).toBe(1234567);
  });

  it('rejects responses that do not have the expected shape instead of guessing', async () => {
    const bad = [{ block: { header: { chain_id: 'x', height: 'abc', time: '2026-11-18T08:00:00Z' } } }, { block: {} }, { height: 5 }, { block: { header: { chain_id: 'x', height: '5', time: 'yesterday' } } }];
    for (const body of bad) await expect(make(asFetch(async () => json(body))).probe()).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('reports HTTP failures, network failures and non-JSON bodies as distinct, typed errors', async () => {
    await expect(make(asFetch(async () => json({}, 503))).probe()).rejects.toMatchObject({ kind: 'http', status: 503 });
    await expect(make(asFetch(async () => Promise.reject(new TypeError('Failed to fetch')))).probe()).rejects.toMatchObject({ kind: 'network' });
    await expect(make(asFetch(async () => new Response('<html>', { status: 200 }))).probe()).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('times out a request that never answers', async () => {
    const hang = (_: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    await expect(make(asFetch(hang), { timeoutMs: 20 }).probe()).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('spaces requests out (client-side rate limit)', async () => {
    const times: number[] = [];
    const fetchFn = async (input: RequestInfo | URL) => {
      times.push(Date.now());
      return String(input).endsWith('/blocks/latest') ? json(latest) : json(nodeInfo);
    };
    await createLiveClient({ baseUrl: 'https://rest.example.test', fetchFn: asFetch(fetchFn), minIntervalMs: 60 }).probe();
    expect((times[1] ?? 0) - (times[0] ?? 0)).toBeGreaterThanOrEqual(55);
  });

  it('refuses plain-http endpoints that are not localhost', () => {
    expect(() => createLiveClient({ baseUrl: 'http://rest.example.test' })).toThrow(LiveRequestError);
    expect(() => createLiveClient({ baseUrl: 'http://localhost:1317' })).not.toThrow();
  });
});

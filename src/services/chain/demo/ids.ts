import { bech32Encode } from '@/lib/bech32';
import { hashString, hexBytes, mulberry32, randomBytes, rngFor } from '@/lib/prng';

/**
 * Demo block / transaction hashes.
 *
 * Real hashes are opaque, but the simulator has no database to look them up in. So the first 48 bits of
 * every demo hash are an invertible scramble of (kind, height, index) and the remaining 208 bits are
 * seeded noise. That makes `/transactions/:hash` an O(1) lookup, while the hash still looks random.
 */

const MASK = (1n << 48n) - 1n;
const MULTIPLIER = 0x5851f42d4c95n; // odd ⇒ invertible modulo 2^48

function modInverse(a: bigint): bigint {
  let inv = a;
  for (let i = 0; i < 6; i++) inv = (inv * (2n - a * inv)) & MASK; // Newton iteration: doubles correct bits
  return inv;
}
const INVERSE = modInverse(MULTIPLIER);

export type RefKind = 'block' | 'tx';

export function encodeRef(chainId: string, kind: RefKind, height: number, index = 0): string {
  const packed = (BigInt(height) << 13n) | (BigInt(index & 0xfff) << 1n) | (kind === 'tx' ? 1n : 0n);
  const head = ((packed * MULTIPLIER) & MASK).toString(16).padStart(12, '0');
  const tail = hexBytes(mulberry32(hashString(`ref|${chainId}|${packed}`)), 26);
  return (head + tail).toUpperCase();
}

export interface DecodedRef {
  kind: RefKind;
  height: number;
  index: number;
}

/** Returns the reference only if the hash is genuinely one this simulator would have produced. */
export function decodeRef(chainId: string, hash: string): DecodedRef | null {
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) return null;
  const head = BigInt(`0x${hash.slice(0, 12)}`);
  const packed = (head * INVERSE) & MASK;
  const kind: RefKind = (packed & 1n) === 1n ? 'tx' : 'block';
  const index = Number((packed >> 1n) & 0xfffn);
  const height = Number(packed >> 13n);
  if (encodeRef(chainId, kind, height, index) !== hash.toUpperCase()) return null;
  return { kind, height, index };
}

/** Account address with a valid bech32 checksum, e.g. `cosmos1…`. */
export function accountAddress(prefix: string, ...seed: Array<string | number>): string {
  return bech32Encode(prefix, randomBytes(rngFor('acct', ...seed), 20));
}

/** Validator operator address, e.g. `cosmosvaloper1…`. */
export function validatorAddress(prefix: string, ...seed: Array<string | number>): string {
  return bech32Encode(`${prefix}valoper`, randomBytes(rngFor('val', ...seed), 20));
}

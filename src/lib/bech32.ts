/**
 * Minimal bech32 (BIP-173) codec. Cosmos SDK chains use classic bech32 (not bech32m) for account and
 * validator addresses, e.g. `cosmos1…` / `osmo1…` / `cosmosvaloper1…`.
 * Used to generate demo addresses with REAL checksums and to validate user input in the Send form.
 */

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GENERATOR[i] as number;
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

function createChecksum(hrp: string, data: number[]): number[] {
  const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const out: number[] = [];
  for (let p = 0; p < 6; p++) out.push((mod >>> (5 * (5 - p))) & 31);
  return out;
}

/** Regroup bits (e.g. 8-bit bytes ⇄ 5-bit words). Returns null on invalid padding when `pad` is false. */
export function convertBits(data: ArrayLike<number>, from: number, to: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const maxv = (1 << to) - 1;
  for (let i = 0; i < data.length; i++) {
    const value = data[i] as number;
    if (value < 0 || value >> from !== 0) return null;
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
    acc &= (1 << (bits + from)) - 1; // keep the accumulator small
  }
  if (pad) {
    if (bits > 0) out.push((acc << (to - bits)) & maxv);
  } else if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) {
    return null;
  }
  return out;
}

export function bech32Encode(hrp: string, bytes: ArrayLike<number>): string {
  const words = convertBits(bytes, 8, 5, true) as number[];
  const checksum = createChecksum(hrp, words);
  return `${hrp}1${[...words, ...checksum].map((w) => CHARSET[w]).join('')}`;
}

export interface DecodedBech32 {
  hrp: string;
  bytes: Uint8Array;
}

export function bech32Decode(input: string): DecodedBech32 | null {
  if (input.length < 8 || input.length > 90) return null;
  const lower = input.toLowerCase();
  if (input !== lower && input !== input.toUpperCase()) return null; // mixed case is invalid
  const sep = lower.lastIndexOf('1');
  if (sep < 1 || sep + 7 > lower.length) return null;
  const hrp = lower.slice(0, sep);
  const data: number[] = [];
  for (const ch of lower.slice(sep + 1)) {
    const v = CHARSET.indexOf(ch);
    if (v === -1) return null;
    data.push(v);
  }
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) return null;
  const bytes = convertBits(data.slice(0, -6), 5, 8, false);
  return bytes ? { hrp, bytes: Uint8Array.from(bytes) } : null;
}

export type AddressCheck = { ok: true; hrp: string } | { ok: false; reason: 'format' | 'prefix' | 'length' };

/** Validate a Cosmos-style address against an expected prefix (e.g. "cosmos"). */
export function checkAddress(address: string, expectedPrefix: string): AddressCheck {
  const decoded = bech32Decode(address.trim());
  if (!decoded) return { ok: false, reason: 'format' };
  if (decoded.hrp !== expectedPrefix) return { ok: false, reason: 'prefix' };
  if (decoded.bytes.length !== 20 && decoded.bytes.length !== 32) return { ok: false, reason: 'length' };
  return { ok: true, hrp: decoded.hrp };
}

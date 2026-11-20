import { checkAddress } from '@/lib/bech32';

/** What a search box entry looks like, decided without talking to any data source. */
export type QueryKind = 'empty' | 'height' | 'hash' | 'address' | 'validatorAddress' | 'denom' | 'text' | 'invalid';
export type InvalidReason = 'tooLong' | 'badChecksum' | 'badHash' | 'badChars';

export interface QueryInfo {
  kind: QueryKind;
  /** The normalised value (trimmed; a leading 0x removed from hashes). */
  value: string;
  reason?: InvalidReason;
}

export const MAX_QUERY_LENGTH = 200;

const DENOM = /^(?:u[a-z]{2,12}|ibc\/[0-9A-Fa-f]{8,64}|factory\/[a-z0-9]+\/[A-Za-z0-9._-]+)$/;
const ALLOWED_TEXT = /^[\p{L}\p{N}\p{M} _.\-/:#@+()']+$/u;

/**
 * Classify a search entry for a chain whose addresses start with `prefix` ("cosmos", "osmo" ...).
 * Pure and synchronous: the UI uses it to decide which lookups to run and which message to show.
 */
export function classifyQuery(raw: string, prefix: string): QueryInfo {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (!value) return { kind: 'empty', value };
  if (value.length > MAX_QUERY_LENGTH) return { kind: 'invalid', value, reason: 'tooLong' };

  if (/^\d{1,12}$/.test(value)) return { kind: 'height', value };

  const hex = value.replace(/^0x/i, '');
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return { kind: 'hash', value: hex.toUpperCase() };
  // looks like a hash but has the wrong length (a typical copy-paste mistake)
  if (/^[0-9a-fA-F]{32,}$/.test(hex)) return { kind: 'invalid', value, reason: 'badHash' };

  const lower = value.toLowerCase();
  if (lower.startsWith(prefix + 'valoper1')) {
    return checkAddress(value, prefix + 'valoper').ok ? { kind: 'validatorAddress', value } : { kind: 'invalid', value, reason: 'badChecksum' };
  }
  if (lower.startsWith(prefix + '1') && value.length >= prefix.length + 20 && !value.includes(' ')) {
    return checkAddress(value, prefix).ok ? { kind: 'address', value } : { kind: 'invalid', value, reason: 'badChecksum' };
  }
  if (DENOM.test(value)) return { kind: 'denom', value };
  if (!ALLOWED_TEXT.test(value)) return { kind: 'invalid', value, reason: 'badChars' };
  return { kind: 'text', value };
}

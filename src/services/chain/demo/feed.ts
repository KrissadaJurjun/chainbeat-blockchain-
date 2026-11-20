import { classifyQuery } from '@/lib/searchQuery';
import { paths } from '@/lib/paths';
import { rngFor } from '@/lib/prng';
import { HOUR_MS } from '@/lib/utils';
import type { AppNotification, ChainConfig, SearchResult } from '@/types/domain';
import { isAccountAddress } from './accounts';
import { blockAt, blockTime, findBlockByHash, findTx, heightAt } from './blocks';
import { buildTokens } from './ecosystem';
import { buildProposals, proposalById } from './governance';
import { validatorBase, validatorsFor } from './validators';

/** Deterministic, simulated activity feed for the notification bell. */
export function buildNotifications(c: ChainConfig, now: number): AppNotification[] {
  const out: AppNotification[] = [];
  const { items } = buildProposals(c, now);
  const day = Math.floor(now / (24 * HOUR_MS));

  // A "new block" alert for every 5,000th block (a stand-in that keeps the bell readable: a real chain makes one block every few seconds)
  const milestone = Math.floor(heightAt(c, now) / 5000) * 5000;
  for (let i = 0; i < 2 && milestone - i * 5000 > 0; i++) {
    const height = milestone - i * 5000;
    out.push({
      id: c.id + ':block:' + height,
      kind: 'block',
      time: blockTime(c, height),
      messageKey: 'notifications.items.newBlock',
      params: { heightAmt: height, chain: c.name },
      href: paths.block(height),
    });
  }

  items
    .filter((p) => p.status === 'voting')
    .forEach((p, i) => {
      out.push({
        id: c.id + ':proposal-voting:' + p.id,
        kind: 'proposal',
        time: now - (i + 1) * 3 * HOUR_MS,
        messageKey: 'notifications.items.proposalVoting',
        params: { id: p.id, hours: Math.max(1, Math.round((p.votingEnd - now) / HOUR_MS)) },
        href: paths.proposal(p.id),
      });
    });

  const decided = items.find((p) => p.status === 'passed');
  if (decided) {
    out.push({
      id: c.id + ':proposal-passed:' + decided.id,
      kind: 'proposal',
      time: now - 19 * HOUR_MS,
      messageKey: 'notifications.items.proposalPassed',
      params: { id: decided.id },
      href: paths.proposal(decided.id),
    });
  }

  const jailed = validatorBase(c).find((v) => v.status === 'jailed');
  if (jailed) {
    out.push({
      id: c.id + ':validator-jailed:' + jailed.address + ':' + (day % 7),
      kind: 'validator',
      time: now - 27 * HOUR_MS,
      messageKey: 'notifications.items.validatorJailed',
      params: { name: jailed.moniker },
      href: paths.validator(jailed.address),
    });
  }
  const rng = rngFor('notif', c.id, day);
  out.push({
    id: c.id + ':upgrade:' + day,
    kind: 'network',
    time: now - 41 * HOUR_MS,
    messageKey: 'notifications.items.upgradeScheduled',
    params: { version: 'v' + (9 + Math.floor(rng() * 8)) + '.' + Math.floor(rng() * 5) + '.0', days: 3 + Math.floor(rng() * 9) },
    href: paths.network,
  });
  out.push({
    id: c.id + ':ibc:' + day,
    kind: 'ibc',
    time: now - 52 * HOUR_MS,
    messageKey: 'notifications.items.ibcVolume',
    params: { pct: Math.round(6 + rng() * 22) },
    href: paths.ibc,
  });
  return out.sort((a, b) => b.time - a.time);
}

const fmtHeight = (n: number): string => '#' + n.toLocaleString('en-US');

/** Search across the selected network's simulated entities. Pages are added by the UI layer. */
export function searchEntities(c: ChainConfig, now: number, rawQuery: string): SearchResult[] {
  const info = classifyQuery(rawQuery, c.bech32Prefix);
  const out: SearchResult[] = [];
  const tip = heightAt(c, now);

  if (info.kind === 'empty' || info.kind === 'invalid') return out;

  if (info.kind === 'height') {
    const n = Number(info.value);
    if (n >= 1 && n <= tip) out.push({ kind: 'block', id: 'block:' + n, label: fmtHeight(n), hint: blockAt(c, n).hash.slice(0, 12), href: paths.block(n) });
    const proposal = proposalById(c, n, now);
    if (proposal) out.push({ kind: 'proposal', id: 'proposal:' + n, label: '#' + n, hint: proposal.title, href: paths.proposal(n) });
    return out;
  }
  if (info.kind === 'hash') {
    const tx = findTx(c, now, info.value);
    if (tx) out.push({ kind: 'transaction', id: 'tx:' + tx.hash, label: tx.hash.slice(0, 18) + '…', hint: fmtHeight(tx.height), href: paths.tx(tx.hash) });
    const block = findBlockByHash(c, now, info.value);
    if (block) out.push({ kind: 'block', id: 'block:' + block.height, label: fmtHeight(block.height), hint: block.hash.slice(0, 12), href: paths.block(block.height) });
    return out;
  }
  if (info.kind === 'validatorAddress') {
    const v = validatorsFor(c, now).find((x) => x.operatorAddress === info.value);
    if (v) out.push({ kind: 'validator', id: 'val:' + v.operatorAddress, label: v.moniker, hint: v.status, href: paths.validator(v.operatorAddress) });
    return out;
  }
  if (info.kind === 'address') {
    if (isAccountAddress(c, info.value)) out.push({ kind: 'address', id: 'addr:' + info.value, label: info.value.slice(0, 22) + '…', href: paths.account(info.value) });
    return out;
  }

  const q = info.value.toLowerCase();
  const tokens = buildTokens(c, now);
  if (info.kind === 'denom') {
    for (const t of tokens.filter((x) => x.denom.toLowerCase().includes(q)).slice(0, 4)) {
      out.push({ kind: 'token', id: 'token:' + t.symbol, label: t.symbol, hint: t.denom, href: paths.tokensFor(t.symbol) });
    }
    return out;
  }

  // free text: validator names, token symbols / names, proposal titles
  validatorBase(c)
    .filter((v) => v.moniker.toLowerCase().includes(q))
    .slice(0, 4)
    .forEach((v) => out.push({ kind: 'validator', id: 'val:' + v.address, label: v.moniker, hint: v.status, href: paths.validator(v.address) }));
  tokens
    .filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.denom.toLowerCase().includes(q))
    .slice(0, 4)
    .forEach((t) => out.push({ kind: 'token', id: 'token:' + t.symbol, label: t.symbol, hint: t.name, href: paths.tokensFor(t.symbol) }));
  if (q.length >= 3) {
    buildProposals(c, now)
      .items.filter((p) => p.title.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((p) => out.push({ kind: 'proposal', id: 'proposal:' + p.id, label: '#' + p.id, hint: p.title, href: paths.proposal(p.id) }));
  }
  return out;
}

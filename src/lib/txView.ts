import { getAsset } from '@/services/chain/registry';
import type { ChainConfig, Tx, TxEvent, TxType } from '@/types/domain';

/** Coarse transaction categories used by filters and badges. */
export type TxGroup = 'transfer' | 'staking' | 'governance' | 'ibc' | 'swap' | 'other';
export const TX_GROUPS: readonly TxGroup[] = ['transfer', 'staking', 'governance', 'ibc', 'swap', 'other'];

const GROUP_OF: Record<TxType, TxGroup> = {
  send: 'transfer',
  delegate: 'staking',
  undelegate: 'staking',
  claim: 'staking',
  vote: 'governance',
  'ibc-transfer': 'ibc',
  swap: 'swap',
  other: 'other',
};
export const txGroup = (type: TxType): TxGroup => GROUP_OF[type];

/** Cosmos SDK message type URLs (what a block explorer shows as the message type). */
const MESSAGE: Record<TxType, string> = {
  send: '/cosmos.bank.v1beta1.MsgSend',
  delegate: '/cosmos.staking.v1beta1.MsgDelegate',
  undelegate: '/cosmos.staking.v1beta1.MsgUndelegate',
  claim: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  vote: '/cosmos.gov.v1beta1.MsgVote',
  'ibc-transfer': '/ibc.applications.transfer.v1.MsgTransfer',
  swap: '/osmosis.gamm.v1beta1.MsgSwapExactAmountIn',
  other: '/cosmos.authz.v1beta1.MsgGrant',
};
export const messageType = (type: TxType): string => MESSAGE[type];

const MODULE: Record<TxType, string> = {
  send: 'bank',
  delegate: 'staking',
  undelegate: 'staking',
  claim: 'distribution',
  vote: 'governance',
  'ibc-transfer': 'ibc_channel',
  swap: 'gamm',
  other: 'authz',
};

const baseDenom = (symbol: string): string => 'u' + symbol.toLowerCase();
const micro = (amount: number, symbol: string): string => String(Math.round(amount * 10 ** (getAsset(symbol)?.decimals ?? 6)));
const coin = (amount: number, symbol: string): string => micro(amount, symbol) + baseDenom(symbol);

/** The proposal a simulated vote transaction refers to (deterministic, always among the most recent proposals). */
export const votedProposalId = (tx: Tx, chain: ChainConfig): number => Math.max(1, chain.proposalsTotal - ((tx.height + tx.index) % 18));

/** Events the transaction would emit, in the shape Cosmos SDK explorers show. Failed transactions emit only the fee event. */
export function buildTxEvents(tx: Tx, chain: ChainConfig): TxEvent[] {
  const fee = coin(tx.feeAmount, tx.feeSymbol);
  const events: TxEvent[] = [{ type: 'tx', attributes: [{ key: 'fee', value: fee }, { key: 'fee_payer', value: tx.from }] }];
  if (tx.status === 'failed') return events;

  events.push({
    type: 'message',
    attributes: [
      { key: 'action', value: messageType(tx.type) },
      { key: 'sender', value: tx.from },
      { key: 'module', value: MODULE[tx.type] },
    ],
  });
  const amount = coin(tx.amount, tx.symbol);
  const to = tx.to ?? '';
  switch (tx.type) {
    case 'send':
      events.push(
        { type: 'coin_spent', attributes: [{ key: 'spender', value: tx.from }, { key: 'amount', value: amount }] },
        { type: 'coin_received', attributes: [{ key: 'receiver', value: to }, { key: 'amount', value: amount }] },
        { type: 'transfer', attributes: [{ key: 'recipient', value: to }, { key: 'sender', value: tx.from }, { key: 'amount', value: amount }] },
      );
      break;
    case 'delegate':
      events.push({ type: 'delegate', attributes: [{ key: 'validator', value: to }, { key: 'amount', value: amount }] });
      break;
    case 'undelegate':
      events.push({
        type: 'unbond',
        attributes: [
          { key: 'validator', value: to },
          { key: 'amount', value: amount },
          { key: 'completion_time', value: new Date(tx.time + chain.unbondingDays * 86_400_000).toISOString() },
        ],
      });
      break;
    case 'claim':
      events.push({ type: 'withdraw_rewards', attributes: [{ key: 'amount', value: amount }, { key: 'validator', value: to }] });
      break;
    case 'vote':
      events.push({ type: 'proposal_vote', attributes: [{ key: 'option', value: 'VOTE_OPTION_YES' }, { key: 'proposal_id', value: String(votedProposalId(tx, chain)) }] });
      break;
    case 'ibc-transfer':
      events.push(
        {
          type: 'ibc_transfer',
          attributes: [
            { key: 'sender', value: tx.from },
            { key: 'receiver', value: to },
            { key: 'amount', value: micro(tx.amount, tx.symbol) },
            { key: 'denom', value: baseDenom(tx.symbol) },
          ],
        },
        { type: 'send_packet', attributes: [{ key: 'packet_src_port', value: 'transfer' }, { key: 'packet_src_channel', value: 'channel-141' }, { key: 'packet_dst_channel', value: 'channel-0' }] },
      );
      break;
    case 'swap':
      events.push({ type: 'token_swapped', attributes: [{ key: 'sender', value: tx.from }, { key: 'pool_id', value: '1' }, { key: 'tokens_in', value: amount }] });
      break;
    default:
      break;
  }
  return events;
}

function messageBody(tx: Tx, chain: ChainConfig): Record<string, unknown> {
  const amount = [{ denom: baseDenom(tx.symbol), amount: micro(tx.amount, tx.symbol) }];
  const head = { '@type': messageType(tx.type) };
  switch (tx.type) {
    case 'send':
      return { ...head, from_address: tx.from, to_address: tx.to, amount };
    case 'delegate':
    case 'undelegate':
      return { ...head, delegator_address: tx.from, validator_address: tx.to, amount: amount[0] };
    case 'claim':
      return { ...head, delegator_address: tx.from, validator_address: tx.to };
    case 'vote':
      return { ...head, proposal_id: String(votedProposalId(tx, chain)), voter: tx.from, option: 'VOTE_OPTION_YES' };
    case 'ibc-transfer':
      return {
        ...head,
        source_port: 'transfer',
        source_channel: 'channel-141',
        token: amount[0],
        sender: tx.from,
        receiver: tx.to,
        timeout_height: { revision_number: '1', revision_height: String(tx.height + 1000) },
      };
    case 'swap':
      return { ...head, sender: tx.from, routes: [{ pool_id: '1', token_out_denom: baseDenom(chain.symbol) }], token_in: amount[0], token_out_min_amount: '1' };
    default:
      return { ...head, granter: tx.from };
  }
}

/** A synthetic tx_response shaped like a Cosmos SDK REST result. Clearly flagged as simulated. */
export function buildRawTx(tx: Tx, chain: ChainConfig): Record<string, unknown> {
  const failed = tx.status === 'failed';
  return {
    simulated: 'Demo Mode: synthetic record shaped like a Cosmos SDK tx_response. It does not exist on any blockchain.',
    txhash: tx.hash,
    height: String(tx.height),
    codespace: failed ? 'sdk' : '',
    code: failed ? 5 : 0,
    raw_log: failed ? 'failed to execute message; message index: 0: ' + (tx.errorCode ?? 'error') : '',
    gas_wanted: String(tx.gasWanted),
    gas_used: String(tx.gasUsed),
    timestamp: new Date(tx.time).toISOString(),
    tx: {
      body: { messages: [messageBody(tx, chain)], memo: tx.memo, timeout_height: '0' },
      auth_info: { fee: { amount: [{ denom: baseDenom(tx.feeSymbol), amount: micro(tx.feeAmount, tx.feeSymbol) }], gas_limit: String(tx.gasWanted), payer: '', granter: '' } },
    },
    events: buildTxEvents(tx, chain),
  };
}

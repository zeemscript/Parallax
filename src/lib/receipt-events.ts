export interface OnChainReceiptEvent {
  id: string;
  bountyId: number;
  contributor: string;
  repo: string;
  issue: number;
  pullRequest: string;
  /** Human USDC amount (converted from 7-decimal stroops when >= 10_000_000). */
  amount: number;
  paidAt: string;
  txHash: string;
}

export interface RawSorobanEvent {
  id?: string;
  txHash?: string;
  ledgerClosedAt?: string;
  topic?: unknown[];
  value?: {
    repo?: string;
    issue?: number;
    pull_request?: string;
    amount?: number | string;
    xdr?: string;
  };
}

const USDC_STROOPS = 10_000_000;

export function normalizeUsdcAmount(raw: number | string): number {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= USDC_STROOPS ? Math.round(n / USDC_STROOPS) : n;
}

/**
 * Decode Soroban RPC `getEvents` entries for the escrow contract's `receipt` event:
 * topics: `["receipt", id, contributor]`, data: `{ repo, issue, pull_request, amount }`.
 */
export function decodeReceiptEvents(
  events: RawSorobanEvent[],
  contributorAddress?: string | null,
): OnChainReceiptEvent[] {
  const target = contributorAddress?.trim().toUpperCase();
  const out: OnChainReceiptEvent[] = [];

  for (const ev of events) {
    const topics = Array.isArray(ev.topic) ? ev.topic : [];
    if (topics[0] && String(topics[0]) !== 'receipt') continue;
    const bountyId = Number(topics[1] ?? 0) || 1;
    const contributor = String(topics[2] ?? target ?? '').trim().toUpperCase();
    if (target && contributor && contributor !== target) continue;

    let val = ev.value;
    if (val?.xdr && !val.repo) {
      try {
        val = JSON.parse(atob(val.xdr));
      } catch {
        continue;
      }
    }
    if (!val || !val.repo || val.issue === undefined || val.amount === undefined) continue;

    const amount = normalizeUsdcAmount(val.amount);
    if (amount <= 0) continue;

    out.push({
      id: ev.id || `ev_${bountyId}_${ev.txHash || out.length}`,
      bountyId,
      contributor,
      repo: String(val.repo),
      issue: Number(val.issue),
      pullRequest: String(val.pull_request ?? ''),
      amount,
      paidAt: (ev.ledgerClosedAt || new Date().toISOString()).slice(0, 10),
      txHash: String(ev.txHash || `tx_${bountyId}`),
    });
  }

  return out;
}

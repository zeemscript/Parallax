import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, GitPullRequest } from 'lucide-react';
import {
  dateLabel, formatMoney, initialState, isOwnApplication, isStellarAddress, repoName, shortAddress, statusTone,
} from '../lib/model';
import { PLATFORM } from '../lib/platform';
import { decodeReceiptEvents, type OnChainReceiptEvent, type RawSorobanEvent } from '../lib/receipt-events';
import { useApp } from '../lib/store';
import { Chip, Empty, Item, ModalHost, Page, PageHead, Stagger } from '../components/ui';

export function ContributorWork() {
  const { state, setState, notify } = useApp();
  const [prFor, setPrFor] = useState<string | null>(null);
  const [pr, setPr] = useState('');
  const [err, setErr] = useState('');

  const mine = state.applications.filter(isOwnApplication);
  const active = mine.filter(a => ['Assigned', 'PR submitted'].includes(a.status)).length;

  const submitPr = () => {
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/[1-9]\d*\/?$/.test(pr.trim())) {
      setErr('Enter a GitHub pull request URL.');
      return;
    }
    setState(s => ({
      ...s,
      applications: s.applications.map(a =>
        a.issueId === prFor && isOwnApplication(a) ? { ...a, status: 'PR submitted', pr: pr.trim() } : a),
    }));
    setPrFor(null);
    setPr('');
    notify('Pull request submitted for review.');
  };

  return (
    <Page>
      <PageHead
        title="Assignments"
        sub={`${active} of 3 concurrent slots in use.`}
        action={<Link className="btn sm" to="/explore">Find issues<ArrowRight size={13} /></Link>}
      />
      {mine.length ? (
        <Stagger className="list">
          {mine.map(app => {
            const issue = state.issues.find(i => i.id === app.issueId);
            if (!issue) return null;
            const repo = state.repos.find(r => r.id === issue.repoId);
            return (
              <Item key={app.issueId}>
                <div className="list-row">
                  <span className="mono dim issue-num">#{issue.id}</span>
                  <span className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                    <Link className="row-title" to={`/issue/${issue.id}`}>{issue.title}</Link>
                    <span className="row-sub">{repo ? repoName(repo) : ''}</span>
                  </span>
                  <Chip tone={statusTone(app.status)}>
                    {app.status}
                  </Chip>
                  {app.status === 'Assigned' && (
                    <button className="btn xs primary" onClick={() => { setErr(''); setPrFor(app.issueId); }}>
                      <GitPullRequest size={12} />Submit PR
                    </button>
                  )}
                </div>
              </Item>
            );
          })}
        </Stagger>
      ) : (
        <Empty title="No applications yet">
          Send a proposal from any open issue and it will appear here.
        </Empty>
      )}

      <ModalHost open={!!prFor} title="Submit your pull request" onClose={() => setPrFor(null)}>
        <p>Link the work you want reviewed.</p>
        <label className="field">
          <span>Pull request URL</span>
          <input className="input" type="url" autoFocus aria-label="Pull request URL"
            placeholder="https://github.com/owner/repo/pull/123"
            value={pr} onChange={e => { setPr(e.target.value); if (err) setErr(''); }} />
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary block" onClick={submitPr}>Submit for review</button>
      </ModalHost>
    </Page>
  );
}

const ESCROW_CONTRACT_ID = 'CBESCROW7TESTNET4PARALLAX2SOROBAN5USDC6BOUNTY7CONTRACT8ID';

export function ContributorReceipts() {
  const { state } = useApp();
  const me = state.session.contributor;
  const mine = state.receipts.filter(r => r.contributor === me);
  const [onChainState, setOnChainState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'loaded'; items: OnChainReceiptEvent[] }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  useEffect(() => {
    const addr = state.payoutAddress;
    if (!addr) {
      setOnChainState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setOnChainState({ kind: 'loading' });
    const rpcUrl =
      (PLATFORM.network as string) === 'mainnet' || (PLATFORM.network as string) === 'public'
        ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
        : 'https://soroban-testnet.stellar.org';

    fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getEvents',
        params: {
          filters: [
            {
              type: 'contract',
              contractIds: [ESCROW_CONTRACT_ID],
              topics: [['receipt', '*', addr]],
            },
          ],
        },
      }),
    })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          result?: { events?: RawSorobanEvent[] };
          error?: { message?: string };
        };
        if (json.error?.message) throw new Error(json.error.message);
        const decoded = decodeReceiptEvents(json.result?.events ?? [], addr);
        if (!cancelled) {
          setOnChainState({ kind: 'loaded', items: decoded });
        }
      })
      .catch(err => {
        if (!cancelled) {
          const detail = err instanceof Error && err.message ? err.message : 'network error';
          setOnChainState({ kind: 'error', message: `Could not load on-chain receipts from Soroban RPC (${detail}).` });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.payoutAddress]);

  const onChainItems = onChainState.kind === 'loaded' ? onChainState.items : [];
  const total = mine.reduce((sum, r) => sum + r.amount, 0) + onChainItems.reduce((sum, r) => sum + r.amount, 0);
  const explorerSegment =
    (PLATFORM.network as string) === 'mainnet' || (PLATFORM.network as string) === 'public'
      ? 'public'
      : 'testnet';

  return (
    <Page>
      <PageHead title="Receipts" sub={`One for every bounty released to you. Portable proof of the work you shipped.`} />
      <div className="grid c3">
        <div className="card stat">
          <p className="label">Earned</p>
          <strong className="num">${formatMoney(total)}</strong>
          <small>{PLATFORM.asset}, all time</small>
        </div>
        <div className="card stat">
          <p className="label">Receipts</p>
          <strong className="num">{mine.length + onChainItems.length}</strong>
          <small>Merged and paid</small>
        </div>
        <div className="card stat">
          <p className="label">Payout address</p>
          <strong className="num">{state.payoutAddress ? shortAddress(state.payoutAddress) : 'Not set'}</strong>
          <small>{state.payoutAddress ? `${PLATFORM.chain} account` : <Link to="/me/settings">Add one in settings</Link>}</small>
        </div>
      </div>

      {state.payoutAddress && (
        <section className="section" data-onchain-receipts-section={onChainState.kind}>
          <div className="row section-head">
            <h2>On-chain receipts</h2>
            <Chip>{PLATFORM.chain} {PLATFORM.network}</Chip>
          </div>
          {onChainState.kind === 'loading' && (
            <p className="hint" role="status">Fetching on-chain receipt events from Soroban RPC…</p>
          )}
          {onChainState.kind === 'error' && (
            <p className="err" role="alert" data-onchain-receipts-error="true">{onChainState.message}</p>
          )}
          {onChainState.kind === 'loaded' && (
            onChainItems.length ? (
              <Stagger className="list">
                {onChainItems.map(r => (
                  <Item key={r.id}>
                    <div className="list-row" data-onchain-receipt-row={r.id}>
                      <span className="mono dim issue-num">#{r.issue}</span>
                      <span className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                        <span className="row-title">{r.repo} #{r.issue}</span>
                        <span className="row-sub">
                          {dateLabel(r.paidAt)}
                          {r.pullRequest && (
                            <>
                              {' · '}
                              <a href={r.pullRequest} target="_blank" rel="noreferrer" data-onchain-pr-link="true">
                                {r.pullRequest.replace('https://github.com/', '')}
                              </a>
                            </>
                          )}
                          {' · '}
                          <a
                            href={`https://stellar.expert/explorer/${explorerSegment}/tx/${r.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            data-onchain-tx-link="true"
                          >
                            View transaction<ArrowUpRight size={11} />
                          </a>
                        </span>
                      </span>
                      <Chip className="solid num">+${formatMoney(r.amount)}</Chip>
                    </div>
                  </Item>
                ))}
              </Stagger>
            ) : (
              <p className="hint" data-onchain-receipts-empty="true">
                No on-chain receipt events found for {shortAddress(state.payoutAddress)} yet.
              </p>
            )
          )}
        </section>
      )}

      <section className="section" data-preview-receipts-section="true">
        <div className="row section-head">
          <h2>Ledger</h2>
          <span data-preview-badge="true"><Chip>preview</Chip></span>
        </div>
        {mine.length ? (
          <Stagger className="list">
            {mine.map(r => {
              const issue = state.issues.find(i => i.id === r.issueId);
              const repo = state.repos.find(x => x.id === r.repoId);
              return (
                <Item key={r.id}>
                  <div className="list-row">
                    <span className="mono dim issue-num">#{r.issueId}</span>
                    <span className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                      {issue
                        ? <Link className="row-title" to={`/issue/${issue.id}`}>{issue.title}</Link>
                        : <span className="row-title">Issue #{r.issueId}</span>}
                      <span className="row-sub">
                        {repo ? repoName(repo) : ''} · {dateLabel(r.paidAt)} · <span className="mono">{r.id}</span>
                      </span>
                    </span>
                    <span data-preview-receipt-label="true"><Chip>preview</Chip></span>
                    <Chip className="solid num">+${formatMoney(r.amount)}</Chip>
                  </div>
                </Item>
              );
            })}
          </Stagger>
        ) : <Empty title="No receipts yet">A receipt is written when a maintainer merges your pull request and releases the bounty.</Empty>}
        <p className="hint" style={{ marginTop: 'var(--s3)' }}>
          Preview receipts are stored in this browser. Once the escrow contract is live they are written to {PLATFORM.chain} {PLATFORM.network}.
        </p>
      </section>
    </Page>
  );
}

export function ContributorSettings() {
  const { state, setState, notify } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(state.session.contributor ?? '');
  const [address, setAddress] = useState(state.payoutAddress ?? '');
  const [addressErr, setAddressErr] = useState('');
  const [confirm, setConfirm] = useState(false);

  const saveAddress = () => {
    const value = address.trim().toUpperCase();
    if (value && !isStellarAddress(value)) {
      setAddressErr(`Enter a ${PLATFORM.chain} public key: G followed by 55 letters and digits.`);
      return;
    }
    setState(s => ({ ...s, payoutAddress: value || null }));
    setAddress(value);
    notify(value ? 'Payout address saved.' : 'Payout address removed.');
  };

  return (
    <Page>
      <PageHead title="Settings" />
      <div className="card submit-form">
        <label className="field">
          <span>Display name</span>
          <input className="input" aria-label="Display name" maxLength={40}
            value={name} onChange={e => setName(e.target.value)} />
        </label>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary sm" onClick={() => {
            if (!name.trim()) return;
            setState(s => ({ ...s, session: { ...s.session, contributor: name.trim() } }));
            notify('Profile saved.');
          }}>Save</button>
          <button className="btn ghost sm" onClick={() => {
            setState(s => ({ ...s, session: { ...s.session, contributor: null } }));
            notify('Signed out.');
            navigate('/explore');
          }}>Sign out</button>
        </div>
      </div>

      <div className="card submit-form">
        <label className="field">
          <span>{PLATFORM.chain} payout address</span>
          <input className="input mono" aria-label="Payout address" spellCheck={false}
            placeholder="G…" value={address}
            onChange={e => { setAddress(e.target.value); if (addressErr) setAddressErr(''); }} />
        </label>
        {addressErr
          ? <p className="err" role="alert">{addressErr}</p>
          : <p className="hint">Released bounties are sent here in {PLATFORM.asset}. The account needs a {PLATFORM.asset} trustline; until it has one, payouts wait as a claimable balance.</p>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary sm" onClick={saveAddress}>Save address</button>
        </div>
      </div>

      <div className="card submit-form">
        <div className="row">
          <span className="col" style={{ gap: 2 }}>
            <strong className="row-title">Reset preview data</strong>
            <span className="row-sub">Clears profiles, repositories, issues, proposals, and receipts.</span>
          </span>
          <span className="spacer" />
          <button className="btn sm danger" onClick={() => setConfirm(true)}>Reset</button>
        </div>
      </div>

      <ModalHost open={confirm} title="Reset this preview?" onClose={() => setConfirm(false)}>
        <p>Everything stored locally is removed and the sample data comes back.</p>
        <button className="btn primary block" onClick={() => {
          setState(initialState());
          setConfirm(false);
          notify('Preview reset.');
          navigate('/');
        }}>Reset preview data</button>
      </ModalHost>
    </Page>
  );
}

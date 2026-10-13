import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowUpRight, Check, GitPullRequest, Lock } from 'lucide-react';
import { applicantName, formatMoney, isOwnApplication, repoName, shortAddress, statusTone } from '../lib/model';
import { PLATFORM } from '../lib/platform';
import { useApp } from '../lib/store';
import { Avatar, Chip, Crumbs, Empty, ModalHost, Page } from '../components/ui';

const ESCROW_CONTRACT_ID = 'CBESCROW7TESTNET4PARALLAX2SOROBAN5USDC6BOUNTY7CONTRACT8ID';

interface OnChainBounty {
  amount: number;
  status: 'Open' | 'Paid' | 'Refunded';
  assignee: string | null;
}

export function IssuePage() {
  const { issueId } = useParams();
  const { state, setState, notify } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [chainState, setChainState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'loaded'; data: OnChainBounty }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const issue = state.issues.find(i => i.id === issueId);

  useEffect(() => {
    const bountyId = issue?.bountyId;
    if (bountyId === undefined) {
      setChainState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setChainState({ kind: 'loading' });
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
        method: 'simulateTransaction',
        params: {
          contractId: ESCROW_CONTRACT_ID,
          function: 'get',
          args: [bountyId],
        },
      }),
    })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as {
          result?: {
            bounty?: {
              amount?: number;
              status?: 'Open' | 'Paid' | 'Refunded';
              assignee?: string | null;
            };
          };
          error?: { message?: string };
        };
        if (payload.error) throw new Error(payload.error.message || 'RPC error');
        const b = payload.result?.bounty;
        if (!b || typeof b.amount !== 'number' || !b.status) {
          throw new Error('Malformed simulation response');
        }
        if (!cancelled) {
          setChainState({
            kind: 'loaded',
            data: {
              amount: b.amount,
              status: b.status,
              assignee: b.assignee ?? null,
            },
          });
        }
      })
      .catch(e => {
        if (!cancelled) {
          const detail = e instanceof Error && e.message ? e.message : 'network error';
          setChainState({ kind: 'error', message: `Could not read on-chain escrow (${detail}).` });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [issue?.id, issue?.bountyId]);

  if (!issue) return <Navigate to="/explore" replace />;

  const repo = state.repos.find(r => r.id === issue.repoId)!;
  const me = state.session.contributor;
  const proposals = state.applications.filter(a => a.issueId === issue.id);
  const mine = proposals.find(isOwnApplication);
  const taken = proposals.find(a => ['Assigned', 'PR submitted', 'Paid'].includes(a.status));
  const paid = taken?.status === 'Paid';
  const canApply = !mine && !taken;
  const explorerSegment =
    (PLATFORM.network as string) === 'mainnet' || (PLATFORM.network as string) === 'public'
      ? 'public'
      : 'testnet';
  const contractExplorerUrl = `https://stellar.expert/explorer/${explorerSegment}/contract/${ESCROW_CONTRACT_ID}`;

  const submit = () => {
    if (message.trim().length < 30) { setErr('Add at least 30 characters so the maintainer can judge your plan.'); return; }
    setState(s => ({
      ...s,
      applications: [...s.applications, { issueId: issue.id, message: message.trim(), status: 'Applied' }],
    }));
    setOpen(false);
    setMessage('');
    notify('Proposal sent. Track it in your workspace.');
  };

  const startApply = () => {
    if (!me) { navigate(`/login?next=${encodeURIComponent(`/issue/${issue.id}`)}`); return; }
    setErr('');
    setOpen(true);
  };

  const label = mine
    ? (mine.status === 'Rejected' ? 'Not selected' : `Proposal ${mine.status.toLowerCase()}`)
    : paid ? 'Bounty paid'
      : taken ? 'Already assigned' : 'Apply to this issue';

  return (
    <Page className="detail">
      <div className="detail-inner">
        <Crumbs items={[{ label: 'Explore', to: '/explore' }, { label: repoName(repo), to: `/explore?q=${encodeURIComponent(repo.name)}` }, { label: `#${issue.id}` }]} />

        <div className="detail-grid">
          <article>
            <header className="detail-head">
              <div className="row wrap" style={{ gap: 6 }}>
                <Chip className="solid num">${formatMoney(issue.bounty)} {PLATFORM.asset}</Chip>
                <Chip>{issue.complexity}</Chip>
                <Chip tone={paid ? '' : 'ok'}>{paid ? 'Paid out' : 'Escrowed'}</Chip>
              </div>
              <h1>{issue.title}</h1>
              <div className="row dim" style={{ gap: 7, fontSize: 'var(--t3)' }}>
                <Avatar name={repo.org} org={repo.org} square />
                <span>{repoName(repo)}</span>
              </div>
            </header>

            <section className="prose">
              <h2>Description</h2>
              <p>{issue.description}</p>
              <h2>Acceptance criteria</h2>
              <ul className="criteria">
                {issue.criteria.map(c => <li key={c}><Check size={13} /><span>{c}</span></li>)}
              </ul>
            </section>

            <section className="proposals">
              <div className="row" style={{ marginBottom: 'var(--s3)' }}>
                <h2>Proposals</h2>
                <Chip className="num">{proposals.length}</Chip>
                <span className="spacer" />
                <button className="btn primary sm" disabled={!canApply} onClick={startApply}>{label}</button>
              </div>
              {proposals.length ? (
                <div className="list">
                  {proposals.map(p => (
                    <div className="proposal" key={`${p.issueId}-${p.applicant ?? 'me'}`}>
                      <div className="row" style={{ gap: 8 }}>
                        <Avatar name={applicantName(p, me ?? '?')} />
                        <strong className="row-title">{applicantName(p, me ?? 'You')}</strong>
                        {isOwnApplication(p) && <Chip>You</Chip>}
                        <span className="spacer" />
                        <Chip tone={statusTone(p.status)}>
                          {p.status}
                        </Chip>
                      </div>
                      <p className="muted proposal-body">{p.message}</p>
                    </div>
                  ))}
                </div>
              ) : <Empty title="No proposals yet">Be the first to send a plan for this issue.</Empty>}
            </section>
          </article>

          <aside className="detail-side">
            <div className="card side-card" data-bounty-card="true">
              <p className="label">Bounty</p>
              <div className="side-row"><span className="muted">Escrow</span><span className="row" style={{ gap: 5 }}><Lock size={11} />{paid ? 'Released' : 'Held'}</span></div>
              <div className="side-row"><span className="muted">Network</span><span>{PLATFORM.chain} {PLATFORM.network}</span></div>
              <div className="side-row total"><span>Paid on merge</span><span className="num">${formatMoney(issue.bounty)}</span></div>
              {issue.bountyId !== undefined && (
                <div className="col" style={{ gap: 6, marginTop: 8 }} data-onchain-escrow={chainState.kind}>
                  {chainState.kind === 'loading' && (
                    <p className="hint" role="status">Reading live escrow state from Soroban RPC…</p>
                  )}
                  {chainState.kind === 'error' && (
                    <p className="err" role="alert" data-onchain-error="true">{chainState.message}</p>
                  )}
                  {chainState.kind === 'loaded' && (
                    <>
                      <div className="side-row">
                        <span className="muted">On-chain status</span>
                        <Chip tone={chainState.data.status === 'Paid' ? 'ok' : chainState.data.status === 'Refunded' ? 'bad' : 'warn'}>
                          {chainState.data.status}
                        </Chip>
                      </div>
                      <div className="side-row">
                        <span className="muted">On-chain amount</span>
                        <span className="num" data-onchain-amount="true">${formatMoney(chainState.data.amount)} {PLATFORM.asset}</span>
                      </div>
                      <div className="side-row">
                        <span className="muted">On-chain assignee</span>
                        <span className="mono" data-onchain-assignee="true">
                          {chainState.data.assignee ? shortAddress(chainState.data.assignee) : 'Unassigned'}
                        </span>
                      </div>
                      {chainState.data.amount !== issue.bounty && (
                        <p className="err" role="alert" data-escrow-amount-warning="true">
                          Warning: On-chain escrow amount (${formatMoney(chainState.data.amount)}) differs from listed bounty (${formatMoney(issue.bounty)}).
                        </p>
                      )}
                      <a
                        className="row side-link"
                        href={contractExplorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        data-contract-explorer-link="true"
                      >
                        View contract on Stellar.Expert<ArrowUpRight size={12} />
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="card side-card">
              <p className="label">Repository</p>
              <Link className="row side-link" to={`/explore?q=${encodeURIComponent(repo.name)}`}>
                <Avatar name={repo.org} org={repo.org} square size="lg" />
                <span className="col" style={{ gap: 1, minWidth: 0 }}>
                  <span className="row-title">{repo.name}</span>
                  <span className="row-sub">{repo.org}</span>
                </span>
              </Link>
              <a className="btn sm block" href={`https://github.com/${repoName(repo)}`} target="_blank" rel="noreferrer">
                View on GitHub<ArrowUpRight size={12} />
              </a>
            </div>
            <div className="card side-card">
              <p className="label">Assigned</p>
              <p className="muted">{taken ? applicantName(taken, me ?? 'You') : 'Nobody yet'}</p>
              {taken?.pr && (
                <a className="row side-link" href={taken.pr} target="_blank" rel="noreferrer">
                  <GitPullRequest size={13} />Pull request
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>

      <ModalHost open={open} title="Apply to this issue" onClose={() => setOpen(false)}>
        <p>{issue.title}</p>
        <label className="field">
          <span>Your plan</span>
          <textarea
            className="textarea"
            rows={6}
            autoFocus
            aria-label="Your plan"
            placeholder="How would you approach this? Mention relevant experience and how you would verify it."
            value={message}
            onChange={e => { setMessage(e.target.value); if (err) setErr(''); }}
          />
        </label>
        {err ? <p className="err" role="alert">{err}</p> : <p className="hint">At least 30 characters.</p>}
        <button className="btn primary block" onClick={submit}>Send proposal</button>
      </ModalHost>
    </Page>
  );
}

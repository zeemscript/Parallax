import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Download, GitPullRequest } from 'lucide-react';
import {
  dateLabel, formatMoney, initialState, isOwnApplication, isStellarAddress, repoName, shortAddress, statusTone,
} from '../lib/model';
import { PLATFORM } from '../lib/platform';
import { useApp } from '../lib/store';
import { receiptsToCsv } from '../lib/receiptsCsv.js';
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

export function ContributorReceipts() {
  const { state, notify } = useApp();
  const me = state.session.contributor;
  const mine = state.receipts.filter(r => r.contributor === me);
  const total = mine.reduce((sum, r) => sum + r.amount, 0);

  const exportCsv = () => {
    const csv = receiptsToCsv(mine.map(receipt => {
      const issue = state.issues.find(item => item.id === receipt.issueId);
      const repo = state.repos.find(item => item.id === receipt.repoId);
      return {
        id: receipt.id,
        date: receipt.paidAt,
        repository: repo ? repoName(repo) : '',
        issueNumber: receipt.issueId,
        issueTitle: issue?.title ?? `Issue #${receipt.issueId}`,
        pullRequest: receipt.pr,
        amount: receipt.amount,
        asset: PLATFORM.asset,
        payoutAddress: receipt.address ?? '',
      };
    }));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'parallax-receipts.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    notify('Receipts exported as CSV.');
  };

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
          <strong className="num">{mine.length}</strong>
          <small>Merged and paid</small>
        </div>
        <div className="card stat">
          <p className="label">Payout address</p>
          <strong className="num">{state.payoutAddress ? shortAddress(state.payoutAddress) : 'Not set'}</strong>
          <small>{state.payoutAddress ? `${PLATFORM.chain} account` : <Link to="/me/settings">Add one in settings</Link>}</small>
        </div>
      </div>
      <section className="section">
        <div className="row section-head">
          <h2>Ledger</h2>
          <span className="spacer" />
          <button className="btn sm" type="button" onClick={exportCsv} disabled={!mine.length}>
            <Download size={13} />Export CSV
          </button>
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

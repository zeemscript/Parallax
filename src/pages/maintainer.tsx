import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight, Check, Clock, GitPullRequest, Plus, ShieldCheck, Star, X,
} from 'lucide-react';
import {
  applicantName, dateLabel, escrowedTotal, formatMoney, isOwnApplication, nextIssueId, repoName,
  reposOwnedBy, statusTone, suggestedBounty, type Application, type Complexity, type Issue, type Repo,
} from '../lib/model';
import { useApp } from '../lib/store';
import { PLATFORM } from '../lib/platform';
import { Avatar, Chip, EASE, Empty, Item, Markdown, ModalHost, Page, PageHead, Stagger } from '../components/ui';

const STATUS_TONE: Record<Repo['status'], string> = { Pending: 'warn', Verified: 'ok', Rejected: 'bad' };
const LEVELS: Complexity[] = ['Trivial', 'Medium', 'High'];

/* --------------------------------------------------------- repository list */

export function MaintainerHome() {
  const { state, setState, notify } = useApp();
  const me = state.session.maintainer!;
  const mine = reposOwnedBy(state.repos, me);

  // The preview cannot check GitHub permissions, so verification is an explicit action.
  const review = (id: string, decision: 'Verified' | 'Rejected') => {
    setState(s => ({
      ...s,
      repos: s.repos.map(r => r.id === id ? {
        ...r,
        status: decision,
        reviewNote: decision === 'Verified'
          ? 'Maintainer access confirmed.'
          : 'Could not confirm maintainer access to this repository.',
      } : r),
    }));
    notify(decision === 'Verified' ? 'Repository verified. Its dashboard is now open.' : 'Verification failed.');
  };

  if (!mine.length) {
    return (
      <Page>
        <PageHead title="Your repositories" sub="Connect a repository to start funding its issues." />
        <div className="gate">
          <span className="gate-icon"><Plus size={20} /></span>
          <h2>No repositories connected</h2>
          <p className="muted">
            Connect a repository and verify you maintain it. Its dashboard opens once verification passes,
            and from there you can post issues with an escrowed bounty.
          </p>
          <Link className="btn primary lg" to="/maintainer/submit">Connect a repository<ArrowRight size={14} /></Link>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHead
        title="Your repositories"
        sub="Each verified repository gets its own dashboard."
        action={<Link className="btn primary sm" to="/maintainer/submit"><Plus size={14} />Connect</Link>}
      />
      <Stagger className="grid c2">
        {mine.map(repo => {
          const gated = repo.status !== 'Verified';
          const issues = state.issues.filter(i => i.repoId === repo.id).length;
          return (
            <Item key={repo.id} className={gated ? 'card repo-card gated' : 'card repo-card'}>
              <div className="row" style={{ gap: 9 }}>
                <Avatar name={repo.org} org={repo.org} square size="lg" />
                <span className="col" style={{ gap: 1, minWidth: 0 }}>
                  <span className="row-title">{repo.name}</span>
                  <span className="row-sub">{repo.org}</span>
                </span>
                <span className="spacer" />
                <Chip tone={STATUS_TONE[repo.status]}>{repo.status}</Chip>
              </div>

              <p className="muted repo-desc">{repo.description}</p>

              {repo.status === 'Verified' ? (
                <>
                  <div className="row repo-stats">
                    <span className="dim"><span className="num">{issues}</span> issues</span>
                    <span className="dim row" style={{ gap: 4 }}><Star size={12} /><span className="num">{repo.stars}</span></span>
                  </div>
                  <Link className="btn primary sm block" to={`/maintainer/repo/${repo.id}`}>
                    Open dashboard<ArrowRight size={13} />
                  </Link>
                </>
              ) : (
                <>
                  <div className="note">
                    {repo.status === 'Pending' ? <Clock size={14} /> : <X size={14} />}
                    <span>
                      {repo.status === 'Pending'
                        ? 'Verifying maintainer access. The dashboard opens once this passes.'
                        : repo.reviewNote ?? 'Could not confirm maintainer access.'}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm" onClick={() => review(repo.id, 'Verified')}>
                      <ShieldCheck size={13} />Simulate verification
                    </button>
                    {repo.status === 'Pending' && (
                      <button className="btn sm ghost" onClick={() => review(repo.id, 'Rejected')}>Simulate failure</button>
                    )}
                  </div>
                </>
              )}
            </Item>
          );
        })}
      </Stagger>
      <p className="hint gate-hint">
        Verification is simulated locally — the preview has no GitHub connection to check permissions.
      </p>
    </Page>
  );
}

/* --------------------------------------------------------------- submission */

export function MaintainerSubmit() {
  const { state, setState, notify } = useApp();
  const navigate = useNavigate();
  const me = state.session.maintainer!;
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const match = url.trim().match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)\/?$/);
    if (!match) { setErr('Enter owner/repository, or a GitHub repository URL.'); return; }
    const [, org, name] = match;
    if (state.repos.some(r => r.org.toLowerCase() === org.toLowerCase() && r.name.toLowerCase() === name.toLowerCase())) {
      setErr('That repository is already connected.');
      return;
    }
    const repo: Repo = {
      id: crypto.randomUUID(),
      org, name,
      description: desc.trim() || 'Connected for funded issues.',
      languages: ['TypeScript'],
      stars: 0, forks: 0,
      ownerId: me,
      status: 'Pending',
      submitted: new Date().toISOString().slice(0, 10),
    };
    setState(s => ({ ...s, repos: [repo, ...s.repos] }));
    notify('Repository connected. Verifying maintainer access.');
    navigate('/maintainer');
  };

  return (
    <Page>
      <PageHead title="Connect a repository" sub={`Verify you maintain it, then fund its issues with ${PLATFORM.asset} bounties held in escrow on ${PLATFORM.chain}.`} />
      <form className="card submit-form" onSubmit={submit}>
        <label className="field">
          <span>GitHub repository</span>
          <input className="input" aria-label="GitHub repository" autoFocus required
            placeholder="organization/repository" value={url}
            onChange={e => { setUrl(e.target.value); if (err) setErr(''); }} />
        </label>
        <label className="field">
          <span>What does it do?</span>
          <textarea className="textarea" rows={4} maxLength={500} aria-label="What does it do?"
            placeholder="One or two sentences contributors will see."
            value={desc} onChange={e => setDesc(e.target.value)} />
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" type="submit">Connect repository</button>
          <Link className="btn ghost" to="/maintainer">Cancel</Link>
        </div>
      </form>
      <div className="note submit-note">
        <ShieldCheck size={14} />
        <span>Connecting does not open a dashboard. Maintainer access has to be verified first.</span>
      </div>
    </Page>
  );
}

/* -------------------------------------------------------- per-repo dashboard */

function useRepo() {
  const { repoId } = useParams();
  const { state } = useApp();
  return state.repos.find(r => r.id === repoId);
}

export function RepoDashboard() {
  const { state } = useApp();
  const repo = useRepo();
  if (!repo) return <Navigate to="/maintainer" replace />;

  const issues = state.issues.filter(i => i.repoId === repo.id);
  const ids = new Set(issues.map(i => i.id));
  const proposals = state.applications.filter(a => ids.has(a.issueId));
  const waiting = proposals.filter(a => a.status === 'Applied').length;
  const assigned = proposals.filter(a => ['Assigned', 'PR submitted'].includes(a.status)).length;
  const escrowed = escrowedTotal(issues, proposals);
  const paidOut = state.receipts.filter(r => r.repoId === repo.id).reduce((sum, r) => sum + r.amount, 0);

  return (
    <Page>
      <PageHead
        title={repo.name}
        sub={<>Dashboard for <strong>{repoName(repo)}</strong> only.</>}
        action={<Link className="btn sm" to={`/maintainer/repo/${repo.id}/issues`}>Issues &amp; proposals<ArrowRight size={13} /></Link>}
      />

      <Stagger className="grid c4">
        {[
          { label: 'In escrow', value: `$${formatMoney(escrowed)}`, note: `${issues.length} funded ${issues.length === 1 ? 'issue' : 'issues'}` },
          { label: 'Awaiting review', value: waiting, note: 'Proposals to triage' },
          { label: 'In progress', value: assigned, note: 'Assigned contributors' },
          { label: 'Paid out', value: `$${formatMoney(paidOut)}`, note: 'Released on merge' },
        ].map(s => (
          <Item key={s.label} className="card stat">
            <p className="label">{s.label}</p>
            <strong className="num">{s.value}</strong>
            <small>{s.note}</small>
          </Item>
        ))}
      </Stagger>

      <section className="section">
        <div className="row section-head">
          <h2>Needs your attention</h2>
          <span className="spacer" />
          <Link className="btn xs ghost" to={`/maintainer/repo/${repo.id}/issues`}>View all</Link>
        </div>
        {waiting ? (
          <Stagger className="list">
            {issues.filter(i => proposals.some(p => p.issueId === i.id && p.status === 'Applied')).map(issue => {
              const n = proposals.filter(p => p.issueId === issue.id && p.status === 'Applied').length;
              return (
                <Item key={issue.id}>
                  <Link className="list-row" to={`/maintainer/repo/${repo.id}/issues?issue=${issue.id}`}>
                    <span className="mono dim issue-num">#{issue.id}</span>
                    <span className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                      <span className="row-title">{issue.title}</span>
                      <span className="row-sub">{n} {n === 1 ? 'proposal' : 'proposals'} waiting</span>
                    </span>
                    <Chip className="solid num">{n}</Chip>
                  </Link>
                </Item>
              );
            })}
          </Stagger>
        ) : <Empty title="Nothing waiting">Proposals appear here as contributors apply.</Empty>}
      </section>
    </Page>
  );
}

/* --------------------------------------------------- issues + proposal triage */

export function RepoIssues() {
  const { state, setState, notify } = useApp();
  const repo = useRepo();
  const [open, setOpen] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  if (!repo) return <Navigate to="/maintainer" replace />;

  const issues = state.issues.filter(i => i.repoId === repo.id);
  const proposalsFor = (id: string) => state.applications.filter(a => a.issueId === id);

  const assign = (target: Application) => {
    setState(s => ({
      ...s,
      applications: s.applications.map(a =>
        a.issueId !== target.issueId ? a
          : a.applicant === target.applicant ? { ...a, status: 'Assigned' }
            : a.status === 'Applied' ? { ...a, status: 'Rejected' } : a),
    }));
    notify(`${applicantName(target, state.session.contributor ?? 'You')} assigned.`);
  };

  const decline = (target: Application) => {
    setState(s => ({
      ...s,
      applications: s.applications.map(a =>
        a.issueId === target.issueId && a.applicant === target.applicant ? { ...a, status: 'Rejected' } : a),
    }));
    notify('Proposal declined.');
  };

  // Merging releases the escrowed bounty to the assignee and writes their receipt.
  const release = (issue: Issue, target: Application) => {
    const contributor = applicantName(target, state.session.contributor ?? 'You');
    setState(s => ({
      ...s,
      applications: s.applications.map(a =>
        a.issueId === target.issueId && a.applicant === target.applicant ? { ...a, status: 'Paid' } : a),
      receipts: [{
        id: `rcpt_${crypto.randomUUID().slice(0, 8)}`,
        issueId: issue.id,
        repoId: issue.repoId,
        contributor,
        address: isOwnApplication(target) ? s.payoutAddress : null,
        amount: issue.bounty,
        pr: target.pr ?? '',
        paidAt: new Date().toISOString().slice(0, 10),
      }, ...s.receipts],
    }));
    notify(`Merged. $${formatMoney(issue.bounty)} ${PLATFORM.asset} released to ${contributor}.`);
  };

  return (
    <Page>
      <PageHead
        title="Issues & proposals"
        sub={`Every funded issue on ${repoName(repo)}.`}
        action={<button className="btn primary sm" onClick={() => setPosting(true)}><Plus size={14} />Post an issue</button>}
      />
      {issues.length ? (
        <Stagger className="col" >
          {issues.map(issue => {
            const proposals = proposalsFor(issue.id);
            const chosen = proposals.find(p => ['Assigned', 'PR submitted', 'Paid'].includes(p.status));
            const expanded = open === issue.id;
            return (
              <Item key={issue.id} className="card issue-block">
                <button className="issue-block-head" aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : issue.id)}>
                  <span className="mono dim issue-num">#{issue.id}</span>
                  <span className="col" style={{ gap: 2, minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <span className="row-title">{issue.title}</span>
                    <span className="row-sub">
                      {chosen ? `Assigned to ${applicantName(chosen, 'you')}` :
                        proposals.length ? `${proposals.length} ${proposals.length === 1 ? 'proposal' : 'proposals'}` : 'No proposals yet'}
                    </span>
                  </span>
                  <Chip className="num">${formatMoney(issue.bounty)}</Chip>
                  {chosen
                    ? <Chip tone={statusTone(chosen.status)}>{chosen.status}</Chip>
                    : proposals.length > 0 && <Chip className="solid num">{proposals.length}</Chip>}
                </button>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: EASE }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="issue-block-body">
                        <Markdown className="muted" text={issue.description} />
                        {proposals.length ? proposals.map(p => (
                          <div className="proposal" key={`${p.issueId}-${p.applicant ?? 'me'}`}>
                            <div className="row" style={{ gap: 8 }}>
                              <Avatar name={applicantName(p, state.session.contributor ?? '?')} />
                              <strong className="row-title">{applicantName(p, 'You')}</strong>
                              {isOwnApplication(p) && <Chip>You</Chip>}
                              <span className="spacer" />
                              <Chip tone={statusTone(p.status)}>
                                {p.status}
                              </Chip>
                            </div>
                            <Markdown className="muted proposal-body" text={p.message} />
                            {!chosen && p.status === 'Applied' && (
                              <div className="row" style={{ gap: 6 }}>
                                <button className="btn primary xs" onClick={() => assign(p)}>
                                  <Check size={12} />Assign
                                </button>
                                <button className="btn ghost xs" onClick={() => decline(p)}>Decline</button>
                              </div>
                            )}
                            {p.pr && (
                              <a className="row side-link" href={p.pr} target="_blank" rel="noreferrer">
                                <GitPullRequest size={13} />{p.pr.replace('https://github.com/', '')}
                              </a>
                            )}
                            {p.status === 'PR submitted' && (
                              <button className="btn primary xs" onClick={() => release(issue, p)}>
                                <Check size={12} />Merge &amp; release ${formatMoney(issue.bounty)}
                              </button>
                            )}
                          </div>
                        )) : <p className="hint">No proposals on this issue yet.</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Item>
            );
          })}
        </Stagger>
      ) : <Empty title="No issues yet">Post an issue with a bounty and it appears here and on Explore.</Empty>}

      <ModalHost open={posting} title="Post a funded issue" onClose={() => setPosting(false)}>
        <PostIssueForm
          repo={repo}
          onDone={issue => {
            setState(s => ({ ...s, issues: [{ ...issue, id: nextIssueId(s.issues) }, ...s.issues] }));
            setPosting(false);
            notify(`Issue posted. $${formatMoney(issue.bounty)} ${PLATFORM.asset} set aside in escrow.`);
          }}
        />
      </ModalHost>
    </Page>
  );
}

export function RepoSettings() {
  const { setState, notify } = useApp();
  const navigate = useNavigate();
  const repo = useRepo();
  const [confirm, setConfirm] = useState(false);
  if (!repo) return <Navigate to="/maintainer" replace />;

  return (
    <Page>
      <PageHead title="Repository settings" sub={repoName(repo)} />
      <div className="card submit-form">
        <div className="row">
          <span className="col" style={{ gap: 2 }}>
            <strong className="row-title">Verification</strong>
            <span className="row-sub">Connected {repo.submitted ? dateLabel(repo.submitted) : 'at launch'}</span>
          </span>
          <span className="spacer" />
          <Chip tone={STATUS_TONE[repo.status]}>{repo.status}</Chip>
        </div>
        <hr className="divider" />
        <div className="row">
          <span className="col" style={{ gap: 2 }}>
            <strong className="row-title">Disconnect repository</strong>
            <span className="row-sub">Removes the repository, its unpaid issues, and closes its dashboard.</span>
          </span>
          <span className="spacer" />
          <button className="btn sm danger" onClick={() => setConfirm(true)}>Disconnect</button>
        </div>
      </div>

      <ModalHost open={confirm} title="Disconnect this repository?" onClose={() => setConfirm(false)}>
        <p>{repoName(repo)} will be removed, its unpaid bounties returned from escrow, and its dashboard closed.</p>
        <button className="btn primary block" onClick={() => {
          setState(s => {
            const gone = new Set(s.issues.filter(i => i.repoId === repo.id).map(i => i.id));
            return {
              ...s,
              repos: s.repos.filter(r => r.id !== repo.id),
              issues: s.issues.filter(i => !gone.has(i.id)),
              applications: s.applications.filter(a => !gone.has(a.issueId)),
            };
          });
          setConfirm(false);
          notify('Repository disconnected.');
          navigate('/maintainer');
        }}>Disconnect repository</button>
      </ModalHost>
    </Page>
  );
}


/* ------------------------------------------------------------- post an issue */

function PostIssueForm({ repo, onDone }: { repo: Repo; onDone: (issue: Issue) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState('');
  const [complexity, setComplexity] = useState<Complexity>('Medium');
  const [bounty, setBounty] = useState(String(suggestedBounty('Medium')));
  const [err, setErr] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(bounty);
    const lines = criteria.split('\n').map(l => l.trim()).filter(Boolean);
    if (title.trim().length < 8) { setErr('Give the issue a title of at least 8 characters.'); return; }
    if (!lines.length) { setErr('Add at least one acceptance criterion, one per line.'); return; }
    if (!Number.isInteger(amount) || amount < 10) { setErr(`Set a bounty of at least 10 ${PLATFORM.asset}.`); return; }
    onDone({
      id: '',
      repoId: repo.id,
      title: title.trim(),
      description: description.trim() || title.trim(),
      criteria: lines,
      complexity,
      bounty: amount,
      created: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <form className="col" style={{ gap: 'var(--s3)' }} onSubmit={submit}>
      <label className="field">
        <span>Title</span>
        <input className="input" aria-label="Issue title" autoFocus maxLength={120}
          value={title} onChange={e => { setTitle(e.target.value); setErr(''); }} />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea className="textarea" rows={3} aria-label="Issue description" maxLength={1000}
          value={description} onChange={e => setDescription(e.target.value)} />
      </label>
      <label className="field">
        <span>Acceptance criteria</span>
        <textarea className="textarea" rows={3} aria-label="Acceptance criteria"
          placeholder="One criterion per line" value={criteria}
          onChange={e => { setCriteria(e.target.value); setErr(''); }} />
      </label>
      <div className="row" style={{ gap: 8 }}>
        <label className="field" style={{ flex: 1 }}>
          <span>Complexity</span>
          <select className="select" aria-label="Issue complexity" value={complexity}
            onChange={e => {
              const next = e.target.value as Complexity;
              setComplexity(next);
              setBounty(String(suggestedBounty(next)));
            }}>
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Bounty ({PLATFORM.asset})</span>
          <input className="input num" aria-label="Bounty" inputMode="numeric"
            value={bounty} onChange={e => { setBounty(e.target.value.replace(/\D/g, '')); setErr(''); }} />
        </label>
      </div>
      {err
        ? <p className="err" role="alert">{err}</p>
        : <p className="hint">The bounty is held in escrow when you post and released to the assignee on merge.</p>}
      <button className="btn primary block" type="submit">Post and fund issue</button>
    </form>
  );
}

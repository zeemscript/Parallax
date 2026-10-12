import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, GitMerge, GitPullRequest, Lock,
  ReceiptText, ShieldCheck, Sparkles,
} from 'lucide-react';
import { escrowedTotal, formatCount, formatMoney, relativeDate, repoName, suggestedBounty } from '../lib/model';
import { PLATFORM } from '../lib/platform';
import { useApp } from '../lib/store';
import { Avatar, Chip, EASE, Item, Stagger } from '../components/ui';
import {
  AnimatedContent, Aurora, ClickSpark, CountUp, GlareHover, GradientText,
  Magnet, RotatingText, ScrollProgress, SplitText, StarBorder,
} from '../components/bits';
import { MoltenMetal } from '../components/bits';
import { Lanyard, LogoLoop } from '../components/bits';
import { FanSection, LiveStackSection, SpiralSection, TeamSection } from './sections';

const STEPS = [
  { n: '01', t: 'Connect a repo', d: 'A maintainer connects a repository and verifies they have write access to it.', icon: ShieldCheck },
  { n: '02', t: 'Fund an issue', d: `The issue is posted with a fixed ${PLATFORM.asset} bounty, locked in escrow on ${PLATFORM.chain}.`, icon: Lock },
  { n: '03', t: 'Apply and build', d: 'Contributors send a plan. The maintainer assigns one, who opens a pull request.', icon: GitPullRequest },
  { n: '04', t: 'Merge pays out', d: 'Merging releases the bounty to the contributor and writes their receipt.', icon: GitMerge },
];

const TIERS = [
  { level: 'Trivial' as const, blurb: 'Docs, error messages, a focused accessibility pass.' },
  { level: 'Medium' as const, blurb: 'Feature work with tests and a clear behavioural contract.' },
  { level: 'High' as const, blurb: 'Protocol edges, migrations, signing and security paths.' },
];

const FAQS = [
  { q: `How is ${PLATFORM.name} different from a grant or funding round?`, a: 'There are no rounds, pools or points to split. A maintainer funds one issue at a time, at a price they set, the moment it needs doing. It can sit alongside grant programs rather than replacing them.' },
  { q: 'Where is the money while I work?', a: `In an escrow contract on ${PLATFORM.chain}, from the moment the issue is posted. The maintainer cannot spend it elsewhere, and you can check the balance before you apply.` },
  { q: 'When do I get paid?', a: `When the maintainer merges your pull request. The bounty is released in ${PLATFORM.asset} to your ${PLATFORM.chain} address. If your account is not ready to receive ${PLATFORM.asset} yet, the payout waits as a claimable balance.` },
  { q: 'What is a receipt?', a: 'A record of each paid bounty: repository, issue, pull request, amount and date. Receipts are public, so your history of shipped work travels with you to the next project.' },
  { q: 'What if my pull request is not merged?', a: 'The bounty stays in escrow and the issue can be reassigned. Maintainers review against the criteria the issue was funded on, so the bar is visible before you apply.' },
  { q: 'Is this connected to real funds?', a: `Not yet. This preview keeps profiles, repositories, issues and receipts in your browser. The escrow contract targets ${PLATFORM.chain} ${PLATFORM.network} first; GitHub sign-in and wallet connection are on the roadmap.` },
];

export function Landing() {
  const { state } = useApp();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const accepted = state.repos.filter(r => r.status === 'Verified');
  const escrowed = escrowedTotal(state.issues, state.applications);
  const paidOut = state.receipts.reduce((sum, r) => sum + r.amount, 0);
  const featured = state.issues.slice(0, 5);
  const top = state.issues.slice().sort((a, b) => b.bounty - a.bounty).slice(0, 3);
  const totalStars = accepted.reduce((s, r) => s + r.stars, 0);

  return (
    <ClickSpark>
      <ScrollProgress />

      {/* ------------------------------------------------------------- hero */}
      <section className="hero">
        <MoltenMetal />
        <span className="metal-veil" aria-hidden="true" />
        <div className="hero-inner">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <StarBorder className="hero-badge">
              <span className="hero-badge-in">
                <span className="dot-live" />
                ${formatMoney(escrowed)} {PLATFORM.asset} in escrow
                <span className="dim">·</span>
                {PLATFORM.chain}
              </span>
            </StarBorder>

            <h1 className="hero-title">
              <SplitText text="Every merged PR," />
              <br />
              <GradientText>{`settled on ${PLATFORM.chain}.`}</GradientText>
            </h1>

            <p className="hero-sub">
              {PLATFORM.name} puts a fixed {PLATFORM.asset} bounty on each issue, locks it in escrow
              on {PLATFORM.chain}, and releases it the moment the pull request merges. Contributors
              keep a public receipt for every payout.
            </p>

            <p className="hero-rotate">
              Built for{' '}
              <RotatingText words={['Soroban developers', 'Rust maintainers', 'wallet builders', 'TypeScript devs']} />
            </p>

            <div className="row wrap hero-cta">
              <Magnet>
                <Link className="btn lg primary glow" to="/explore">
                  <GlareHover><span className="row" style={{ gap: 6 }}>Explore issues<ArrowRight size={15} /></span></GlareHover>
                </Link>
              </Magnet>
              <Link className="btn lg" to="/explore/repos">Browse repositories</Link>
            </div>

            <div className="hero-meta">
              <span><CountUp to={state.issues.length} /> funded issues</span>
              <span className="sep">·</span>
              <span><CountUp to={accepted.length} /> repositories</span>
              <span className="sep">·</span>
              <span><CountUp to={escrowed} prefix="$" /> {PLATFORM.asset} in escrow</span>
            </div>
          </motion.div>

          <motion.div
            className="hero-art"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: EASE }}
          >
            <Lanyard>
              <div className="badge-card">
                <span className="badge-hole" aria-hidden="true" />
                <span className="label badge-eyebrow">Receipt</span>
                <p className="badge-name">Paid on merge</p>
                <p className="badge-role">{PLATFORM.chain} {PLATFORM.network}</p>
                <div className="badge-rows">
                  <div className="badge-row"><span>In escrow</span><span>${formatMoney(escrowed)}</span></div>
                  <div className="badge-row"><span>Funded issues</span><span>{state.issues.length}</span></div>
                  <div className="badge-row"><span>Paid out</span><span>${formatMoney(paidOut)}</span></div>
                </div>
                <div className="badge-strip">drag me</div>
              </div>
            </Lanyard>
          </motion.div>
        </div>
      </section>

      {/* --------------------------------------------------- repository strip */}
      <section className="strip">
        <p className="label strip-label">Repositories funding issues</p>
        <LogoLoop speed={34}>
          {accepted.map(r => (
            <Link className="strip-item" to={`/explore?q=${encodeURIComponent(r.name)}`} key={r.id}>
              <Avatar name={r.org} org={r.org} square />
              <span className="col" style={{ gap: 0, minWidth: 0 }}>
                <span className="row-title">{r.name}</span>
                <span className="row-sub">{r.org}</span>
              </span>
            </Link>
          ))}
        </LogoLoop>
      </section>

      {/* ------------------------------------------ bento: two views, one ledger */}
      <section className="band alt">
        <div className="band-inner">
          <AnimatedContent>
            <div className="sec">
              <div>
                <h2>Two views of the same work</h2>
                <p>Maintainers see a backlog that gets done. Contributors see money that is already there.</p>
              </div>
              <Link className="btn" to="/explore">Explore issues<ArrowRight size={14} /></Link>
            </div>
          </AnimatedContent>

          <div className="bento">
            <AnimatedContent className="box w4 tall pad-lg">
              <span className="box-icon"><Lock size={18} /></span>
              <h3>Escrowed per issue, not pooled</h3>
              <p>
                Each issue carries its own price, set by the maintainer and locked on {PLATFORM.chain}
                when it is posted. You know exactly what a merge is worth before you write a line,
                and nobody else's work changes your payout.
              </p>
              <span className="spacer" />
              <div className="box-preview">
                {top.map(issue => {
                  const repo = state.repos.find(r => r.id === issue.repoId);
                  return (
                    <div className="mini-row" key={issue.id}>
                      {repo && <Avatar name={repo.org} org={repo.org} square />}
                      <span className="col" style={{ gap: 1, minWidth: 0, flex: 1 }}>
                        <span className="row-title">{issue.title}</span>
                        <span className="row-sub">{repo ? repoName(repo) : ''}</span>
                      </span>
                      <span className="row-title num hide-sm">${formatMoney(issue.bounty)}</span>
                      <Chip tone="ok">Escrowed</Chip>
                    </div>
                  );
                })}
              </div>
            </AnimatedContent>

            <AnimatedContent className="box w2 tall" delay={0.06}>
              <span className="big-num acc"><CountUp to={state.issues.length} /></span>
              <h3>Funded issues</h3>
              <p>Each carries acceptance criteria and a fixed bounty before it is listed.</p>
              <span className="spacer" />
              <Link className="btn sm" to="/explore">Browse<ArrowRight size={13} /></Link>
            </AnimatedContent>

            <AnimatedContent className="box w2" delay={0.1}>
              <span className="big-num"><CountUp to={accepted.length} /></span>
              <h3>Repositories</h3>
              <p>Verified by the people who maintain them.</p>
            </AnimatedContent>

            <AnimatedContent className="box w2" delay={0.14}>
              <span className="big-num">{formatCount(totalStars)}</span>
              <h3>Stars</h3>
              <p>Across every participating repository.</p>
            </AnimatedContent>

            <AnimatedContent className="box w2" delay={0.18}>
              <span className="big-num acc"><CountUp to={escrowed} prefix="$" /></span>
              <h3>{PLATFORM.asset} in escrow</h3>
              <p>Locked against open issues, waiting on a merge.</p>
            </AnimatedContent>
          </div>
        </div>
      </section>

      <LiveStackSection issues={state.issues} repos={state.repos} />

      {/* -------------------------------------------------------- open right now */}
      <section className="band">
        <div className="band-inner">
          <AnimatedContent>
            <div className="sec">
              <div>
                <h2>Open right now</h2>
                <p>Every issue is scoped and funded by its maintainer before it reaches this list.</p>
              </div>
              <Link className="btn" to="/explore">All issues<ArrowRight size={14} /></Link>
            </div>
          </AnimatedContent>
          <Stagger className="list">
            {featured.map(issue => {
              const repo = state.repos.find(r => r.id === issue.repoId);
              return (
                <Item key={issue.id}>
                  <Link className="list-row" to={`/issue/${issue.id}`}>
                    <span className="mono dim issue-num">#{issue.id}</span>
                    <span className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                      <span className="row-title">{issue.title}</span>
                      <span className="row-sub">{repo ? repoName(repo) : ''}</span>
                    </span>
                    <Chip className="hide-sm">{issue.complexity}</Chip>
                    <Chip className="solid num">${formatMoney(issue.bounty)}</Chip>
                    <ArrowUpRight size={14} className="dim" />
                  </Link>
                </Item>
              );
            })}
          </Stagger>
        </div>
      </section>

      <FanSection />

      {/* ------------------------------------------------------------ four steps */}
      <section className="band alt">
        <div className="band-inner">
          <AnimatedContent>
            <div className="sec">
              <div>
                <h2>From funded to paid</h2>
                <p>Four steps, and the price does not change once the issue is posted.</p>
              </div>
            </div>
          </AnimatedContent>
          <div className="bento">
            {STEPS.map((step, i) => (
              <AnimatedContent className="box w3" key={step.n} delay={i * 0.07}>
                <div className="row">
                  <span className="box-icon"><step.icon size={18} /></span>
                  <span className="spacer" />
                  <span className="big-num step-num">{step.n}</span>
                </div>
                <h3>{step.t}</h3>
                <p>{step.d}</p>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- bounty tiers */}
      <section className="band">
        <div className="band-inner">
          <AnimatedContent>
            <div className="sec">
              <div>
                <h2>Priced up front</h2>
                <p>Maintainers set the bounty. Complexity gives a starting point, not a rule.</p>
              </div>
              <Link className="btn" to="/explore">See open issues<ArrowRight size={14} /></Link>
            </div>
          </AnimatedContent>

          <div className="bento">
            {TIERS.map((t, i) => (
              <AnimatedContent className="box w2" key={t.level} delay={i * 0.07}>
                <span className="box-kicker">{t.level}</span>
                <span className="big-num acc"><CountUp to={suggestedBounty(t.level)} prefix="$" /></span>
                <div className="tier-bar">
                  <motion.span
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: suggestedBounty(t.level) / suggestedBounty('High') }}
                    viewport={{ once: true, margin: '-10% 0px' }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
                  />
                </div>
                <p>{t.blurb}</p>
              </AnimatedContent>
            ))}

            <AnimatedContent className="box w6 pad-lg" delay={0.1}>
              <span className="label"><ReceiptText size={12} style={{ verticalAlign: '-2px' }} /> What every receipt records</span>
              <div className="formula">
                <span className="formula-part">repository</span>
                <span className="formula-op">·</span>
                <span className="formula-part">issue</span>
                <span className="formula-op">·</span>
                <span className="formula-part">pull request</span>
                <span className="formula-op">·</span>
                <span className="formula-part acc">{PLATFORM.asset} paid</span>
              </div>
              <ul className="ticks">
                <li><Check size={14} />The bounty you see is the bounty you get — no splitting with anyone else.</li>
                <li><Check size={14} />Funds are locked when the issue is posted, not promised later.</li>
                <li><Check size={14} />Each payout leaves a public receipt you can point to.</li>
              </ul>
            </AnimatedContent>
          </div>
        </div>
      </section>

      <SpiralSection repos={accepted} />

      {/* ----------------------------------------------------------- maintainers */}
      <section className="band alt">
        <div className="band-inner">
          <AnimatedContent>
            <div className="sec">
              <div>
                <h2>For maintainers</h2>
                <p>Verify once, fund what matters, pay only for merged work.</p>
              </div>
              <Magnet>
                <Link className="btn primary glow" to="/maintainer/login">
                  List your repo<ArrowRight size={14} />
                </Link>
              </Magnet>
            </div>
          </AnimatedContent>

          <div className="bento">
            <AnimatedContent className="box w3 pad-lg">
              <h3>Your backlog, priced and moving</h3>
              <p>
                Connect a repository and you get a dashboard for it alone — post issues with a
                bounty, pick one contributor per issue, and release payment when you merge.
              </p>
              <ul className="ticks">
                {[
                  'A maintainer area separate from the contributor side',
                  'Maintainer access verified before any dashboard opens',
                  'Post an issue and fund it in one step',
                  'Pick one candidate per issue; the rest decline automatically',
                ].map(t => <li key={t}><Check size={14} />{t}</li>)}
              </ul>
            </AnimatedContent>

            <AnimatedContent className="box w3 pad-lg" delay={0.08}>
              <span className="label">Verified repositories</span>
              <div className="box-preview">
                {accepted.slice(0, 5).map(r => (
                  <div className="mini-row" key={r.id}>
                    <Avatar name={r.org} org={r.org} square />
                    <span className="col" style={{ gap: 1, minWidth: 0, flex: 1 }}>
                      <span className="row-title">{r.name}</span>
                      <span className="row-sub">
                        {r.updated ? `Updated ${relativeDate(r.updated)}` : r.org}
                      </span>
                    </span>
                    <Chip tone="ok">Verified</Chip>
                  </div>
                ))}
              </div>
            </AnimatedContent>
          </div>
        </div>
      </section>

      <TeamSection repos={accepted} />

      {/* ------------------------------------------------------------------ faq */}
      <section className="band">
        <div className="band-inner narrow">
          <AnimatedContent>
            <div className="sec">
              <div>
                <h2>Questions</h2>
                <p>How bounties are funded, claimed and paid.</p>
              </div>
            </div>
          </AnimatedContent>
          <div className="faq">
            {FAQS.map((f, i) => (
              <AnimatedContent key={f.q} delay={i * 0.04}>
                <div className={openFaq === i ? 'faq-item open' : 'faq-item'}>
                  <button
                    className="faq-q"
                    aria-expanded={openFaq === i}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span>{f.q}</span>
                    <ChevronDown size={16} className="faq-chev" />
                  </button>
                  <motion.div
                    className="faq-a"
                    initial={false}
                    animate={{ height: openFaq === i ? 'auto' : 0, opacity: openFaq === i ? 1 : 0 }}
                    transition={{ duration: 0.26, ease: EASE }}
                  >
                    <p className="muted">{f.a}</p>
                  </motion.div>
                </div>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ final cta */}
      <section className="band cta-band">
        <Aurora className="cta-aurora" />
        <div className="band-inner">
          <AnimatedContent>
            <div className="cta">
              <Chip className="cta-chip"><Sparkles size={11} />Paid on merge, on {PLATFORM.chain}</Chip>
              <h2 className="cta-title">
                Pick an issue, <GradientText>send a plan.</GradientText>
              </h2>
              <p className="muted">
                {state.issues.length} funded issues are open across {accepted.length} repositories right now.
              </p>
              <div className="row wrap cta-actions">
                <Magnet>
                  <Link className="btn lg primary glow" to="/explore">
                    <GlareHover><span className="row" style={{ gap: 6 }}>Explore issues<ArrowRight size={15} /></span></GlareHover>
                  </Link>
                </Magnet>
                <Link className="btn lg" to="/maintainer/login">List your repo</Link>
              </div>
            </div>
          </AnimatedContent>
        </div>
      </section>

      <footer className="foot">
        <div className="foot-inner">
          <span className="dim">
            {PLATFORM.name} — {PLATFORM.tagline.toLowerCase()}. Preview: no GitHub, wallet, or funds are connected yet.
          </span>
          <div className="row" style={{ gap: 14 }}>
            {PLATFORM.contractId && (
              <a
                className="dim"
                href={`${PLATFORM.contractExplorerUrl}/${encodeURIComponent(PLATFORM.contractId)}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`${PLATFORM.chain} ${PLATFORM.network} escrow contract ${PLATFORM.contractId}`}
              >
                {PLATFORM.network} escrow <span className="mono">{PLATFORM.contractId.slice(0, 5)}…{PLATFORM.contractId.slice(-5)}</span>
              </a>
            )}
            <Link className="dim" to="/explore">Explore</Link>
            <Link className="dim" to="/maintainer/login">List your repo</Link>
          </div>
        </div>
      </footer>
    </ClickSpark>
  );
}

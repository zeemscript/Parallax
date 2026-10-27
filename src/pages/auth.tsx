import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useApp } from '../lib/store';
import { Brand, EASE, Mark } from '../components/ui';
import { PLATFORM } from '../lib/platform';

function AuthFrame({
  kicker, title, sub, children, foot,
}: {
  kicker: string;
  title: string;
  sub: string;
  children: React.ReactNode;
  foot: React.ReactNode;
}) {
  return (
    <div className="auth">
      <header className="auth-bar">
        <Brand />
      </header>
      <main id="main" className="auth-main">
        <motion.div
          className="auth-card card"
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <span className="auth-mark"><Mark size={16} /></span>
          <p className="label">{kicker}</p>
          <h1>{title}</h1>
          <p className="muted auth-sub">{sub}</p>
          {children}
        </motion.div>
        <p className="auth-foot">{foot}</p>
      </main>
    </div>
  );
}

/**
 * Validates and sanitizes the post-login redirect destination (closes #68).
 * Only same-origin, path-only values are accepted:
 * - A single leading '/' not followed by '/' or '\'
 * - No protocol / scheme
 * - Does not loop back to /login
 * Anything else safely falls back to '/explore'.
 */
export function sanitizeNextRedirect(next: string | null | undefined): string {
  if (!next) return '/explore';
  if (/^\/(?![/\\])/.test(next) && !next.includes(':') && !next.startsWith('/login')) {
    return next;
  }
  return '/explore';
}

export function ContributorLogin() {
  const { state, setState, notify } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState(state.session.contributor ?? '');
  const next = params.get('next');
  const dest = sanitizeNextRedirect(next);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setState(s => ({ ...s, session: { ...s.session, contributor: name.trim() } }));
    notify('Signed in as a contributor.');
    navigate(dest);
  };

  return (
    <AuthFrame
      kicker="Contributor"
      title="Sign in to apply"
      sub={`Browse funded issues, send proposals, and collect a receipt for every bounty paid out on ${PLATFORM.chain}. This is a local preview profile.`}
      foot={<>Maintaining a repository? <Link to="/maintainer/login">Use the maintainer sign-in</Link>.</>}
    >
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Display name</span>
          <input className="input" aria-label="Display name" autoFocus required maxLength={40}
            placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
        </label>
        <button className="btn primary block lg" type="submit">Continue<ArrowRight size={14} /></button>
      </form>
    </AuthFrame>
  );
}

export function MaintainerLogin() {
  const { state, setState, notify } = useApp();
  const navigate = useNavigate();
  const [handle, setHandle] = useState(state.session.maintainer ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    setState(s => ({ ...s, session: { ...s.session, maintainer: handle.trim() } }));
    notify('Signed in to the maintainer area.');
    navigate('/maintainer');
  };

  return (
    <AuthFrame
      kicker="Maintainer"
      title="Maintainer sign-in"
      sub={`A separate area from the contributor side. Connect a repository, verify you maintain it, then fund issues with ${PLATFORM.asset} bounties from its dashboard.`}
      foot={<>Looking for issues instead? <Link to="/login">Contributor sign-in</Link>.</>}
    >
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Maintainer handle</span>
          <input className="input" aria-label="Maintainer handle" autoFocus required maxLength={40}
            placeholder="your-github-handle" value={handle} onChange={e => setHandle(e.target.value)} />
        </label>
        <button className="btn primary block lg" type="submit">Enter maintainer area<ArrowRight size={14} /></button>
      </form>
      <div className="note auth-note">
        <ShieldCheck size={14} />
        <span>Ownership is verified before a dashboard opens. Signing in here does not sign you in as a contributor.</span>
      </div>
    </AuthFrame>
  );
}

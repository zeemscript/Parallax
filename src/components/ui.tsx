import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, X } from 'lucide-react';
import { LANG_COLOR, orgAvatar, PLATFORM } from '../lib/platform';

export const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Page-level entrance. Every route body uses this so navigation feels continuous. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Staggered list container — children fade up in sequence. */
export function Stagger({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hide"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.035, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function Item({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hide: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Mark({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M5 19 11 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13 19 19 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export function Brand({ to = '/', label = 'Parallax' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="brand" aria-label={`${label} home`}>
      <span className="brand-mark"><Mark /></span>
      <span className="brand-name">{label}</span>
    </Link>
  );
}

/**
 * Real GitHub organization avatar. The letter tile always renders underneath and
 * the image fades in over it, so the slot is never blank while the fetch is in
 * flight and a 404 simply leaves the tile in place.
 */
export function Avatar({
  name, size = '', square = false, org,
}: {
  name: string;
  size?: string;
  square?: boolean;
  /** GitHub org to pull the real avatar for. Omit for people. */
  org?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const initial = (name || '?').slice(0, 1).toUpperCase();
  const cls = `avatar ${square ? 'sq' : ''} ${size}`.trim();

  if (!org || failed) return <span className={cls}>{initial}</span>;

  return (
    <span className={`${cls} img`}>
      <span className="avatar-fallback" aria-hidden={loaded}>{initial}</span>
      <img
        src={orgAvatar(org, 96)}
        alt=""
        loading="lazy"
        decoding="async"
        data-loaded={loaded}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

/** Language dot in GitHub's colour for that language. */
export function LangDot({ lang }: { lang: string }) {
  return <span className="lang-dot" style={{ background: LANG_COLOR[lang] ?? 'var(--ink-4)' }} aria-hidden="true" />;
}

export function Chip({ children, tone = '', className = '' }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={`chip ${tone} ${className}`.trim()}>{children}</span>;
}

export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="row" style={{ gap: 5 }}>
          {i > 0 && <span className="sep">/</span>}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <strong>{item.label}</strong>}
        </span>
      ))}
    </nav>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Sliding segmented control. The pill animates between options via a shared layoutId. */
export function Segmented<T extends string>({
  value, options, onChange, idPrefix,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  idPrefix: string;
}) {
  return (
    <div className="seg" role="tablist">
      {options.map(opt => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          data-on={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {value === opt.value && (
            <motion.span
              layoutId={`${idPrefix}-pill`}
              className="seg-pill"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <motion.div
      className="modal-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.99 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon sm" aria-label="Close dialog" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function ModalHost({ open, ...rest }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  return <AnimatePresence>{open && <Modal {...rest} />}</AnimatePresence>;
}

/** GitHub glyph for the navbar. */
export function GithubMark({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export type TransactionStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error';

const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: 'The bounty amount must be greater than zero.',
  2: 'No bounty with that ID was found in the escrow contract.',
  3: 'This bounty is already paid or refunded and cannot be changed.',
  4: 'Assign a contributor to this bounty before releasing funds.',
  5: 'This issue already has an open bounty in escrow.',
};

const CONTRACT_NAME_MESSAGES: Record<string, string> = {
  InvalidAmount: CONTRACT_ERROR_MESSAGES[1],
  NotFound: CONTRACT_ERROR_MESSAGES[2],
  NotOpen: CONTRACT_ERROR_MESSAGES[3],
  NotAssigned: CONTRACT_ERROR_MESSAGES[4],
  AlreadyFunded: CONTRACT_ERROR_MESSAGES[5],
};

/** Translates wallet rejections and Soroban escrow contract error codes into plain words. */
export function formatTransactionError(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : '';

  if (err && typeof err === 'object' && 'code' in err) {
    const code = Number((err as { code: unknown }).code);
    if (CONTRACT_ERROR_MESSAGES[code]) return CONTRACT_ERROR_MESSAGES[code];
  }

  if (/user rejected|rejected by user|user declined|declined|cancelled|canceled|denied|refused/i.test(raw)) {
    return 'Transaction was cancelled in your wallet — nothing was submitted.';
  }

  const codeMatch = raw.match(/(?:Error\s*\(\s*Contract\s*,\s*#(\d+)\s*\)|ContractError\s*\(\s*(\d+)\s*\)|#(\d+)\b)/i);
  if (codeMatch) {
    const code = Number(codeMatch[1] ?? codeMatch[2] ?? codeMatch[3]);
    if (CONTRACT_ERROR_MESSAGES[code]) return CONTRACT_ERROR_MESSAGES[code];
  }

  for (const [name, friendly] of Object.entries(CONTRACT_NAME_MESSAGES)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(raw)) return friendly;
  }

  return raw.trim() || 'Transaction failed before confirmation. Please try again.';
}

/** Block explorer URL for a Stellar transaction hash on the configured network. */
export function txExplorerUrl(hash: string, network: string = PLATFORM.network): string {
  const segment = network === 'mainnet' || network === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${segment}/tx/${encodeURIComponent(hash)}`;
}

export interface TransactionHelpers {
  /** Call once the wallet has signed and broadcast the transaction so the toast moves to `pending`. */
  onSigned: (txHash?: string) => void;
}

export type TransactionSubmitFn<T = unknown> = (
  helpers: TransactionHelpers,
) => Promise<{ hash?: string; result?: T } | string | void>;

export interface TransactionController<T = unknown> {
  status: TransactionStatus;
  hash: string | null;
  error: string | null;
  explorerUrl: string | null;
  execute: (overrideFn?: TransactionSubmitFn<T>) => Promise<void>;
  reset: () => void;
}

/**
 * Tracks an on-chain transaction through `idle | signing | pending | success | error`.
 */
export function useTransaction<T = unknown>(defaultSubmit?: TransactionSubmitFn<T>): TransactionController<T> {
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setHash(null);
    setError(null);
  }, []);

  const execute = useCallback(
    async (overrideFn?: TransactionSubmitFn<T>) => {
      const fn = overrideFn ?? defaultSubmit;
      if (!fn) return;
      setStatus('signing');
      setHash(null);
      setError(null);
      try {
        const out = await fn({
          onSigned: (txHash?: string) => {
            if (txHash) setHash(txHash);
            setStatus('pending');
          },
        });
        if (typeof out === 'string' && out) {
          setHash(out);
        } else if (out && typeof out === 'object' && 'hash' in out && typeof out.hash === 'string') {
          setHash(out.hash);
        }
        setStatus('success');
      } catch (err) {
        setError(formatTransactionError(err));
        setStatus('error');
      }
    },
    [defaultSubmit],
  );

  const explorerUrl = hash ? txExplorerUrl(hash) : null;

  return { status, hash, error, explorerUrl, execute, reset };
}

const TX_STATUS_COPY: Record<Exclude<TransactionStatus, 'idle'>, { badge: string; tone: string; title: string }> = {
  signing: {
    badge: 'Signing',
    tone: 'warn',
    title: 'Waiting for wallet signature…',
  },
  pending: {
    badge: 'Submitted',
    tone: 'info',
    title: `Confirming on ${PLATFORM.chain} ${PLATFORM.network}…`,
  },
  success: {
    badge: 'Confirmed',
    tone: 'success',
    title: `Confirmed on ${PLATFORM.chain} ${PLATFORM.network}.`,
  },
  error: {
    badge: 'Failed',
    tone: 'danger',
    title: 'Transaction failed',
  },
};

export function TransactionToast({
  tx,
  label,
}: {
  tx: TransactionController<unknown>;
  label?: string;
}) {
  const reducedMotion = Boolean(useReducedMotion());

  if (tx.status === 'idle') return null;

  const meta = TX_STATUS_COPY[tx.status];
  const shortHash = tx.hash && tx.hash.length > 14 ? `${tx.hash.slice(0, 6)}…${tx.hash.slice(-6)}` : tx.hash;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="toast tx-toast"
        role={tx.status === 'error' ? 'alert' : 'status'}
        aria-live={tx.status === 'error' ? 'assertive' : 'polite'}
        data-tx-status={tx.status}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        initial={reducedMotion ? false : { opacity: 0, y: 12, x: '-50%', scale: 0.96 }}
        animate={reducedMotion ? { opacity: 1, x: '-50%' } : { opacity: 1, y: 0, x: '-50%', scale: 1 }}
        exit={reducedMotion ? { opacity: 0, x: '-50%' } : { opacity: 0, y: 8, x: '-50%', scale: 0.98 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: EASE }}
        style={{ flexWrap: 'wrap', gap: 10, maxWidth: 'min(520px, calc(100vw - 32px))' }}
      >
        <Chip tone={meta.tone}>{meta.badge}</Chip>
        <span style={{ flex: 1, minWidth: 160 }}>
          {label ? `${label}: ` : ''}
          {tx.status === 'error' ? tx.error : meta.title}
        </span>
        {tx.explorerUrl && shortHash && (
          <a
            href={tx.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="mono"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              textDecoration: 'underline',
              color: 'inherit',
              fontSize: 'var(--t2)',
            }}
          >
            {shortHash}
            <ArrowUpRight size={12} />
          </a>
        )}
        <button
          type="button"
          className="btn ghost icon sm"
          aria-label="Dismiss transaction status"
          onClick={tx.reset}
          style={{ color: 'inherit' }}
        >
          <X size={14} />
        </button>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}


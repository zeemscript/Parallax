import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { LANG_COLOR, orgAvatar } from '../lib/platform';

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
  const moveFocus = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!options.length) return;
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight': nextIndex = (index + 1) % options.length; break;
      case 'ArrowLeft': nextIndex = (index - 1 + options.length) % options.length; break;
      case 'Home': nextIndex = 0; break;
      case 'End': nextIndex = options.length - 1; break;
      default: return;
    }
    event.preventDefault();
    onChange(options[nextIndex].value);
    window.setTimeout(() => {
      const tablist = [...document.querySelectorAll<HTMLElement>('[data-segmented]')]
        .find(element => element.dataset.segmented === idPrefix);
      const targetValue = options[nextIndex].value;
      tablist?.querySelector<HTMLButtonElement>(`[role="tab"][data-segment-value="${targetValue}"]`)?.focus();
    }, 50);
  };

  return (
    <div className="seg" role="tablist" data-segmented={idPrefix}>
      {options.map(opt => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          tabIndex={value === opt.value ? 0 : -1}
          data-segment-value={opt.value}
          data-on={value === opt.value}
          onKeyDown={event => moveFocus(event, options.findIndex(item => item.value === opt.value))}
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

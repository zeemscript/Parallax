import {
  useCallback, useEffect, useId, useRef, useState, type ReactNode,
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useAnimationFrame, useMotionValue } from 'motion/react';
import { useReducedMotion } from './motion';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ==========================================================================
   GooeyNav
   A blob tracks the active item. An SVG goo filter merges the blob with the
   particles that burst on activation, so they read as one liquid mass.
   ========================================================================== */

interface GooItem { to: string; label: string; end?: boolean }

export function GooeyNav({ items }: { items: GooItem[] }) {
  const prefersReducedMotion = useReducedMotion();
  const { pathname } = useLocation();
  const filterId = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<{ x: number; w: number } | null>(null);
  const [bursts, setBursts] = useState<{ id: number; x: number }[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion) setBursts([]);
  }, [prefersReducedMotion]);

  // Only commit when the measurement actually changes — setting a fresh object
  // every render would re-trigger this effect and loop forever.
  const sync = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const active = wrap.querySelector<HTMLElement>('a.on');
    if (!active) { setBlob(prev => (prev === null ? prev : null)); return; }
    const wr = wrap.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    const next = { x: Math.round(ar.left - wr.left), w: Math.round(ar.width) };
    setBlob(prev => (prev && prev.x === next.x && prev.w === next.w ? prev : next));
  }, []);

  useEffect(() => {
    sync();
    const ro = new ResizeObserver(sync);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', sync);
    return () => { ro.disconnect(); window.removeEventListener('resize', sync); };
  }, [sync, pathname]);

  const burst = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const ar = e.currentTarget.getBoundingClientRect();
    const id = seq.current++;
    setBursts(b => [...b, { id, x: ar.left - wr.left + ar.width / 2 }]);
    window.setTimeout(() => setBursts(b => b.filter(k => k.id !== id)), 700);
  };

  return (
    <div className="goo" ref={wrapRef}>
      <svg className="goo-defs" aria-hidden="true">
        <defs>
          <filter id={`goo-${filterId}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div className="goo-layer" style={{ filter: `url(#goo-${filterId})` }} aria-hidden="true">
        {blob && (
          <motion.span
            className="goo-blob"
            animate={{ x: blob.x, width: blob.w }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          />
        )}
        <AnimatePresence>
          {bursts.map(b => (
            <span key={b.id} className="goo-burst" style={{ left: b.x }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.i
                  key={i}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{
                    x: Math.cos((i / 6) * Math.PI * 2) * 34,
                    y: Math.sin((i / 6) * Math.PI * 2) * 22,
                    scale: 0,
                    opacity: 0,
                  }}
                  transition={{ duration: 0.62, ease: 'easeOut' }}
                />
              ))}
            </span>
          ))}
        </AnimatePresence>
      </div>

      <nav className="goo-items">
        {items.map(it => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={burst}
            className={({ isActive }) => (isActive ? 'on' : '')}
          >
            {it.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/* ==========================================================================
   Lanyard
   A badge hanging from a cord. Verlet-style spring on the pivot, draggable,
   settles back on release. 2D rather than 3D, but the physics is real.
   ========================================================================== */

export function Lanyard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const prefersReducedMotion = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const cordRef = useRef<SVGPathElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Simulation state kept out of React so the frame loop stays allocation-free.
  const sim = useRef({ x: 0, y: 0, vx: 0, vy: 0, dragging: false, tx: 0, ty: 0 });
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.lanyard-badge') || prefersReducedMotion) return;
      sim.current.dragging = true;
      setHeld(true);
      host.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!sim.current.dragging) return;
      const r = host.getBoundingClientRect();
      sim.current.tx = e.clientX - r.left - r.width / 2;
      sim.current.ty = Math.max(0, e.clientY - r.top - 40);
    };
    const onUp = () => { sim.current.dragging = false; setHeld(false); };
    host.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      host.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [prefersReducedMotion]);

  useAnimationFrame((t, delta) => {
    const s = sim.current;
    if (prefersReducedMotion) {
      s.x = 0;
      s.y = 0;
      s.vx = 0;
      s.vy = 0;
      x.set(0);
      y.set(0);
      cordRef.current?.setAttribute('d', 'M 110 0 Q 110 62 110 76');
      return;
    }
    const dt = Math.min(delta, 32) / 16.67;

    if (s.dragging) {
      s.vx += (s.tx - s.x) * 0.22 * dt;
      s.vy += (s.ty - s.y) * 0.22 * dt;
    } else {
      // Gravity pulls the badge back to rest; a slow breeze keeps it alive.
      const breeze = Math.sin(t / 1400) * 5;
      s.vx += (breeze - s.x) * 0.035 * dt;
      s.vy += (0 - s.y) * 0.05 * dt;
    }
    s.vx *= 0.9;
    s.vy *= 0.9;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    x.set(s.x);
    y.set(s.y);

    // Cord follows as a quadratic curve that slackens with distance.
    const cord = cordRef.current;
    if (cord) {
      const sag = 18 + Math.abs(s.x) * 0.16;
      cord.setAttribute('d', `M 110 0 Q ${110 + s.x * 0.45} ${44 + sag} ${110 + s.x} ${76 + s.y}`);
    }
  });

  return (
    <div ref={hostRef} className={`lanyard ${held ? 'held' : ''} ${className}`}>
      <svg className="lanyard-cord" viewBox="0 0 220 120" preserveAspectRatio="none" aria-hidden="true">
        <path ref={cordRef} d="M 110 0 Q 110 62 110 76" />
      </svg>
      <span className="lanyard-clip" aria-hidden="true" />
      <motion.div className="lanyard-badge" style={{ x, y }}>
        {children}
      </motion.div>
    </div>
  );
}

/* ==========================================================================
   CardSwap
   A stack whose front card retires to the back on a timer.
   ========================================================================== */

export function CardSwap({
  cards, interval = 3200, className = '',
}: {
  cards: { id: string; node: ReactNode }[];
  interval?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [order, setOrder] = useState(() => cards.map((_, i) => i));

  useEffect(() => {
    if (prefersReducedMotion || cards.length < 2) return;
    const t = window.setInterval(() => setOrder(o => [...o.slice(1), o[0]]), interval);
    return () => window.clearInterval(t);
  }, [cards.length, interval, prefersReducedMotion]);

  return (
    <div className={`swap ${className}`}>
      {order.map((cardIdx, pos) => (
        <motion.div
          key={cards[cardIdx].id}
          className="swap-card"
          animate={{
            y: pos * 14,
            x: pos * 10,
            scale: 1 - pos * 0.05,
            opacity: pos > 2 ? 0 : 1 - pos * 0.12,
            zIndex: cards.length - pos,
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          style={{ zIndex: cards.length - pos }}
        >
          {cards[cardIdx].node}
        </motion.div>
      ))}
    </div>
  );
}

/* ==========================================================================
   BounceCards
   Cards fan out from a stack with a spring overshoot as they enter view.
   ========================================================================== */

export function BounceCards({
  children, className = '',
}: {
  children: ReactNode[];
  className?: string;
}) {
  const n = children.length;
  // Cards are ~230px wide, so the horizontal step has to clear most of that
  // or the fan overlaps into an unreadable stack.
  const spread = 7;
  const step = 210;
  return (
    <div className={`bounce ${className}`}>
      {children.map((child, i) => {
        const mid = (n - 1) / 2;
        const rot = (i - mid) * spread;
        const dx = (i - mid) * step;
        return (
          <motion.div
            key={i}
            className="bounce-card"
            initial={{ opacity: 0, y: 40, rotate: 0, x: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, y: Math.abs(i - mid) * 14, rotate: rot, x: dx, scale: 1 }}
            viewport={{ once: true, margin: '-12% 0px' }}
            transition={{ type: 'spring', stiffness: 210, damping: 14, delay: i * 0.075 }}
            whileHover={{ y: -8, rotate: 0, scale: 1.04, zIndex: 10 }}
            style={{ zIndex: n - Math.abs(i - mid) }}
          >
            {child}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   ProfileCard
   Tilts toward the pointer with a holographic sheen tracking the same point.
   ========================================================================== */

export function ProfileCard({
  name, role, handle, avatar, stat,
}: {
  name: string;
  role: string;
  handle: string;
  avatar: ReactNode;
  stat?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || prefersReducedMotion) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 16}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  useEffect(() => {
    if (prefersReducedMotion) reset();
  }, [prefersReducedMotion]);

  return (
    <div className="pcard" ref={ref} onPointerMove={onMove} onPointerLeave={reset}>
      <span className="pcard-holo" aria-hidden="true" />
      <span className="pcard-shine" aria-hidden="true" />
      <div className="pcard-in">
        <div className="pcard-avatar">{avatar}</div>
        <h3 className="pcard-name">{name}</h3>
        <p className="pcard-role">{role}</p>
        <div className="pcard-foot">
          <span className="mono pcard-handle">{handle}</span>
          {stat && <span className="pcard-stat">{stat}</span>}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   InfiniteSpiral
   Items placed on an Archimedean spiral, rotating forever.
   ========================================================================== */

export function InfiniteSpiral({
  items, className = '',
}: {
  items: ReactNode[];
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const n = items.length;
  return (
    <div className={`spiral ${className}`}>
      <motion.div
        className="spiral-stage"
        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 46, ease: 'linear', repeat: Infinity }}
      >
        {items.map((item, i) => {
          // Archimedean: radius grows linearly with the angle.
          const turns = 1.6;
          const t = (i / Math.max(n - 1, 1)) * turns * Math.PI * 2;
          const radius = 34 + (t / (turns * Math.PI * 2)) * 128;
          const angle = t;
          return (
            <motion.div
              key={i}
              className="spiral-item"
              style={{
                left: `calc(50% + ${Math.cos(angle) * radius}px)`,
                top: `calc(50% + ${Math.sin(angle) * radius}px)`,
                zIndex: n - i,
              }}
              animate={prefersReducedMotion ? undefined : { rotate: -360 }}
              transition={{ duration: 46, ease: 'linear', repeat: Infinity }}
            >
              {item}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

/* ==========================================================================
   LogoLoop
   Seamless logo rail. Content is duplicated so the wrap never shows a gap.
   ========================================================================== */

export function LogoLoop({
  children, speed = 32, reverse = false, fade = true, className = '',
}: {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
  fade?: boolean;
  className?: string;
}) {
  return (
    <div className={`logoloop ${fade ? 'faded' : ''} ${className}`}>
      <div
        className="logoloop-track"
        style={{ animationDuration: `${speed}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
      >
        <div className="logoloop-set">{children}</div>
        <div className="logoloop-set" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}

export { EASE };

/**
 * React Bits components, adapted.
 *
 * React Bits (reactbits.dev) ships as copy-paste source rather than an npm
 * dependency, so each component below is its pattern re-implemented against
 * this project's design tokens and the `motion` runtime already in use.
 */
import {
  useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode,
} from 'react';
import {
  AnimatePresence, motion, useInView, useMotionValue, useSpring, useTransform,
} from 'motion/react';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** True when the OS asks for reduced motion. Reveals then render immediately. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ Aurora */
/** Slow-drifting colour field behind the hero. */
export function Aurora({ className = '' }: { className?: string }) {
  return (
    <div className={`bit-aurora ${className}`} aria-hidden="true">
      <span className="bit-aurora-a" />
      <span className="bit-aurora-b" />
      <span className="bit-aurora-c" />
    </div>
  );
}

/* ----------------------------------------------------------------- DotGrid */
/** Dot lattice that brightens around the cursor. */
export function DotGrid({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return <div ref={ref} className={`bit-dotgrid ${className}`} aria-hidden="true" />;
}

/* ------------------------------------------------------------ GradientText */
export function GradientText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`bit-gradient ${className}`}>{children}</span>;
}

/* --------------------------------------------------------------- ShinyText */
/** Light sweeps across the text on a loop. */
export function ShinyText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`bit-shiny ${className}`}>{children}</span>;
}

/* ---------------------------------------------------------------- SplitText */
/** Reveals per word, staggered, once the element scrolls into view. */
export function SplitText({
  text, className = '', delay = 0, as: Tag = 'span',
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: 'span' | 'h1' | 'h2' | 'p';
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduced = useReducedMotion();
  const show = inView || reduced;
  const words = useMemo(() => text.split(' '), [text]);
  const MotionTag = motion[Tag] as typeof motion.span;

  return (
    <MotionTag ref={ref as never} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="bit-split-word" aria-hidden="true">
          <motion.span
            className="bit-split-inner"
            initial={reduced ? false : { y: '110%', opacity: 0 }}
            animate={show ? { y: '0%', opacity: 1 } : undefined}
            transition={{ duration: 0.55, ease: EASE, delay: delay + i * 0.045 }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </MotionTag>
  );
}

/* ----------------------------------------------------------------- CountUp */
/** Counts to a target when scrolled into view. */
export function CountUp({
  to, prefix = '', suffix = '', duration = 1.4, className = '',
}: {
  to: number; prefix?: string; suffix?: string; duration?: number; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduced) { setValue(to); return; }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      // ease-out cubic
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduced]);

  return (
    <span ref={ref} className={`num ${className}`}>
      {prefix}{value.toLocaleString('en-US')}{suffix}
    </span>
  );
}

/* ----------------------------------------------------------- SpotlightCard */
/** Radial highlight that tracks the cursor across the card. */
export function SpotlightCard({
  children, className = '', as = 'div',
}: {
  children: ReactNode; className?: string; as?: 'div' | 'article';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sx', `${e.clientX - r.left}px`);
    el.style.setProperty('--sy', `${e.clientY - r.top}px`);
  }, []);
  const Tag = as as 'div';
  return (
    <Tag ref={ref} className={`bit-spotlight ${className}`} onPointerMove={onMove}>
      <span className="bit-spotlight-glow" aria-hidden="true" />
      <span className="bit-spotlight-body">{children}</span>
    </Tag>
  );
}

/* -------------------------------------------------------------- StarBorder */
/** Conic gradient that travels around the border. */
export function StarBorder({
  children, className = '', ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`bit-starborder ${className}`} {...rest}>
      <span className="bit-starborder-ring" aria-hidden="true" />
      <span className="bit-starborder-inner">{children}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ Magnet */
/** Element drifts toward the pointer while it is nearby. */
export function Magnet({
  children, strength = 0.35, radius = 90, className = '',
}: {
  children: ReactNode; strength?: number; radius?: number; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 22 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 22 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion) {
      x.jump(0);
      y.jump(0);
      return;
    }
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      if (Math.hypot(dx, dy) < r.width / 2 + radius) {
        x.set(dx * strength);
        y.set(dy * strength);
      } else {
        x.set(0);
        y.set(0);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [x, y, strength, radius, prefersReducedMotion]);

  return (
    <motion.span ref={ref} className={`bit-magnet ${className}`} style={{ x, y }}>
      {children}
    </motion.span>
  );
}

/* -------------------------------------------------------------- ClickSpark */
/** Emits a short burst of rays wherever the user clicks inside. */
export function ClickSpark({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const next = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion) setSparks([]);
  }, [prefersReducedMotion]);

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const id = next.current++;
    setSparks(s => [...s, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    window.setTimeout(() => setSparks(s => s.filter(k => k.id !== id)), 520);
  };

  return (
    <div ref={ref} className="bit-spark-host" onClick={onClick}>
      {children}
      <AnimatePresence>
        {sparks.map(s => (
          <span key={s.id} className="bit-spark" style={{ left: s.x, top: s.y }} aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.i
                key={i}
                style={{ rotate: `${i * 45}deg` }}
                initial={{ scaleY: 0.2, opacity: 1 }}
                animate={{ scaleY: 1, opacity: 0, translateY: -14 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            ))}
          </span>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ RotatingText */
/**
 * Cycles words in place. A hidden sizer holds the width of the longest word so
 * the line never reflows, and the swap uses mode="wait" so two words are never
 * legible at once.
 */
export function RotatingText({ words, interval = 2400, className = '' }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  const longest = useMemo(
    () => words.reduce((a, b) => (b.length > a.length ? b : a), ''),
    [words],
  );

  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setI(v => (v + 1) % words.length), interval);
    return () => window.clearInterval(t);
  }, [words.length, interval, reduced]);

  return (
    <span className={`bit-rotate ${className}`}>
      <span className="bit-rotate-sizer" aria-hidden="true">{longest}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={words[i]}
          className="bit-rotate-word"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ---------------------------------------------------------- AnimatedContent */
/** Scroll-triggered reveal with configurable direction and distance. */
export function AnimatedContent({
  children, delay = 0, distance = 24, direction = 'y', className = '',
}: {
  children: ReactNode; delay?: number; distance?: number; direction?: 'x' | 'y'; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-8% 0px' });
  const reduced = useReducedMotion();
  const show = inView || reduced;
  const from = direction === 'y' ? { y: distance } : { x: distance };
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? false : { opacity: 0, ...from }}
      animate={show ? { opacity: 1, x: 0, y: 0 } : undefined}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ----------------------------------------------------------------- Marquee */
/** Seamless infinite strip. Content is duplicated so the loop never gaps. */
export function Marquee({
  children, speed = 34, reverse = false, className = '',
}: {
  children: ReactNode; speed?: number; reverse?: boolean; className?: string;
}) {
  return (
    <div className={`bit-marquee ${className}`}>
      <div
        className="bit-marquee-track"
        style={{ animationDuration: `${speed}s`, animationDirection: reverse ? 'reverse' : 'normal' } as CSSProperties}
      >
        <div className="bit-marquee-set">{children}</div>
        <div className="bit-marquee-set" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- GlareHover */
/** Diagonal sheen that sweeps once on hover. */
export function GlareHover({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`bit-glare ${className}`}>
      {children}
      <span className="bit-glare-sheen" aria-hidden="true" />
    </span>
  );
}

/* ------------------------------------------------------------- TiltedCard */
/** Subtle 3D tilt following the pointer. */
export function TiltedCard({ children, className = '', max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), { stiffness: 220, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), { stiffness: 220, damping: 20 });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={e => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => { mx.set(0); my.set(0); }}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------- ScrollLine */
/** Reading-progress bar pinned to the top of the viewport. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setP(h > 0 ? window.scrollY / h : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div className="bit-progress" style={{ scale: `${p} 1` } as CSSProperties} aria-hidden="true" />;
}

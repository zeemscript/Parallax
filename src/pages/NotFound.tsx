import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Page } from '../components/ui';

export function NotFound() {
  return (
    <Page className="container not-found-page">
      <div
        style={{
          padding: '80px 20px',
          maxWidth: 640,
          margin: '0 auto',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            width: '100%',
            padding: '48px 24px',
            border: '1px dashed var(--line)',
            borderRadius: 'var(--r3)',
            background: 'var(--panel)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--panel-2)',
              border: '1px solid var(--line)',
              color: 'var(--ink-2)',
              marginBottom: 8,
            }}
          >
            <Compass size={28} />
          </div>
          <span
            className="chip"
            style={{
              fontSize: 'var(--t1)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--ink-3)',
            }}
          >
            404 Not Found
          </span>
          <h1 style={{ fontSize: 'var(--t6)', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
            Page not found
          </h1>
          <p style={{ fontSize: 'var(--t3)', color: 'var(--ink-2)', maxWidth: 420, margin: 0, lineHeight: 1.6 }}>
            The link you followed may be broken, or the page may have been moved or removed.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/" className="btn primary">
              <Home size={16} />
              <span>Back to home</span>
            </Link>
            <Link to="/explore" className="btn ghost">
              <Compass size={16} />
              <span>Explore bounties</span>
            </Link>
          </div>
        </div>
      </div>
    </Page>
  );
}

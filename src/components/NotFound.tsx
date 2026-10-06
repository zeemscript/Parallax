import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { Page } from './ui';

export function NotFound({ issue = false }: { issue?: boolean }) {
  const title = issue ? 'Issue not found' : 'Page not found';

  useEffect(() => {
    document.title = `${title} | Parallax`;
    return () => { document.title = 'Parallax — bounties settled on Stellar'; };
  }, [title]);

  return (
    <Page className="not-found-page">
      <section className="not-found-card" aria-labelledby="not-found-title">
        <p className="label">404</p>
        <h1 id="not-found-title">{title}</h1>
        <p className="muted">
          {issue
            ? 'That issue is not in the current Parallax preview.'
            : 'That address does not match a Parallax page.'}
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <Link className="btn primary" to="/explore"><ArrowLeft size={14} />Explore issues</Link>
          <Link className="btn" to="/"><Home size={14} />Home</Link>
        </div>
      </section>
    </Page>
  );
}

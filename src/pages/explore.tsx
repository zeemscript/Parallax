import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, GitFork, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { formatCount, formatMoney, relativeDate, repoName, type Complexity } from '../lib/model';
import { useApp } from '../lib/store';
import { PLATFORM } from '../lib/platform';
import { Avatar, Chip, EASE, Empty, Item, LangDot, Page, Segmented, Stagger } from '../components/ui';

type Tab = 'issues' | 'repos' | 'orgs';

const TABS = [
  { value: 'issues' as const, label: 'Issues' },
  { value: 'repos' as const, label: 'Repositories' },
  { value: 'orgs' as const, label: 'Organizations' },
];

const SORTS = ['Newest', 'Bounty', 'Title'] as const;
const LEVELS: (Complexity | 'Any')[] = ['Any', 'Trivial', 'Medium', 'High'];
const BOUNTY_RANGES = ['Any', 'under $250', '$250–$750', 'over $750'] as const;
type BountyRange = (typeof BOUNTY_RANGES)[number];

export function Explore({ tab }: { tab: Tab }) {
  const { state } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [level, setLevel] = useState<Complexity | 'Any'>('Any');
  const [lang, setLang] = useState('Any');
  const [bountyRange, setBountyRange] = useState<BountyRange>('Any');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get('focus')) {
      searchRef.current?.focus();
      const next = new URLSearchParams(params);
      next.delete('focus');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const accepted = useMemo(() => state.repos.filter(r => r.status === 'Verified'), [state.repos]);
  const languages = useMemo(
    () => ['Any', ...new Set(accepted.flatMap(r => r.languages))],
    [accepted],
  );
  const needle = q.trim().toLowerCase();

  const issues = useMemo(() => {
    const list = state.issues.filter(issue => {
      const repo = accepted.find(r => r.id === issue.repoId);
      if (!repo) return false;
      if (level !== 'Any' && issue.complexity !== level) return false;
      if (lang !== 'Any' && !repo.languages.includes(lang)) return false;
      if (bountyRange !== 'Any') {
        const b = issue.bounty ?? 0;
        if (bountyRange === 'under $250' && !(b < 250)) return false;
        if ((bountyRange === '$250–$750' || bountyRange === '$250-$750') && !(b >= 250 && b <= 750)) return false;
        if (bountyRange === 'over $750' && !(b > 750)) return false;
      }
      return `${issue.title} ${issue.id} ${repoName(repo)}`.toLowerCase().includes(needle);
    });
    return list.sort((a, b) =>
      sort === 'Bounty' ? b.bounty - a.bounty
        : sort === 'Title' ? a.title.localeCompare(b.title)
          : b.created.localeCompare(a.created));
  }, [state.issues, accepted, level, lang, bountyRange, needle, sort]);

  const repos = useMemo(
    () => accepted.filter(r =>
      (lang === 'Any' || r.languages.includes(lang))
      && `${repoName(r)} ${r.description}`.toLowerCase().includes(needle)),
    [accepted, lang, needle],
  );

  const orgs = useMemo(() => {
    const names = [...new Set(accepted.map(r => r.org))];
    return names
      .filter(o => o.toLowerCase().includes(needle))
      .map(o => ({ org: o, repos: accepted.filter(r => r.org === o) }));
  }, [accepted, needle]);

  const activeFilters = (level !== 'Any' ? 1 : 0) + (lang !== 'Any' ? 1 : 0) + (bountyRange !== 'Any' ? 1 : 0);
  const count = tab === 'issues' ? issues.length : tab === 'repos' ? repos.length : orgs.length;

  return (
    <Page className="explore">
      <div className="explore-inner">
        <header className="explore-head">
          <div>
            <h1>Explore</h1>
            <p className="muted">Funded issues across every verified repository. Each bounty is escrowed in {PLATFORM.asset} and paid on merge.</p>
          </div>
        </header>

        <div className="explore-bar">
          <Segmented
            idPrefix="explore"
            value={tab}
            options={TABS}
            onChange={v => navigate(v === 'issues' ? '/explore' : `/explore/${v}`)}
          />
          <label className="search explore-search">
            <Search size={14} />
            <input
              ref={searchRef}
              aria-label="Search"
              placeholder={tab === 'orgs' ? 'Search organizations…' : tab === 'repos' ? 'Search repositories…' : 'Search issues…'}
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            {q && (
              <button className="btn ghost icon xs" aria-label="Clear search" onClick={() => setQ('')}>
                <X size={12} />
              </button>
            )}
          </label>
          {tab !== 'orgs' && (
            <button
              className={activeFilters ? 'btn sm on' : 'btn sm'}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(o => !o)}
            >
              <SlidersHorizontal size={13} />
              Filters
              {activeFilters > 0 && <span className="pipcount num">{activeFilters}</span>}
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {filtersOpen && tab !== 'orgs' && (
            <motion.div
              className="filters"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <div className="filters-inner">
                {tab === 'issues' && (
                  <label className="field inline">
                    <span>Complexity</span>
                    <select className="select" aria-label="Complexity" value={level}
                      onChange={e => setLevel(e.target.value as Complexity | 'Any')}>
                      {LEVELS.map(l => <option key={l}>{l}</option>)}
                    </select>
                  </label>
                )}
                {tab === 'issues' && (
                  <label className="field inline">
                    <span>Bounty</span>
                    <select className="select" aria-label="Bounty" value={bountyRange}
                      onChange={e => setBountyRange(e.target.value as BountyRange)}>
                      {BOUNTY_RANGES.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </label>
                )}
                <label className="field inline">
                  <span>Language</span>
                  <select className="select" aria-label="Language" value={lang} onChange={e => setLang(e.target.value)}>
                    {languages.map(l => <option key={l}>{l}</option>)}
                  </select>
                </label>
                {tab === 'issues' && (
                  <label className="field inline">
                    <span>Sort</span>
                    <select className="select" aria-label="Sort" value={sort}
                      onChange={e => setSort(e.target.value as (typeof SORTS)[number])}>
                      {SORTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                )}
                <button className="btn sm ghost" onClick={() => { setLevel('Any'); setLang('Any'); setSort('Newest'); setBountyRange('Any'); }}>
                  Reset
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="result-count num">{count} {tab === 'issues' ? 'issues' : tab === 'repos' ? 'repositories' : 'organizations'}</p>

        {tab === 'issues' && (issues.length ? (
          <Stagger className="list">
            {issues.map(issue => {
              const repo = accepted.find(r => r.id === issue.repoId)!;
              return (
                <Item key={issue.id}>
                  <Link className="list-row" to={`/issue/${issue.id}`}>
                    <span className="mono dim issue-num">#{issue.id}</span>
                    <span className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                      <span className="row-title">{issue.title}</span>
                      <span className="row-sub">{repoName(repo)}</span>
                    </span>
                    <Chip className="hide-sm">{issue.complexity}</Chip>
                    <Chip className="solid num">${formatMoney(issue.bounty)}</Chip>
                    <ArrowUpRight size={14} className="dim hide-sm" />
                  </Link>
                </Item>
              );
            })}
          </Stagger>
        ) : <Empty title="No issues match">Try a different search or clear the filters.</Empty>)}

        {tab === 'repos' && (repos.length ? (
          <Stagger className="grid c3">
            {repos.map(r => (
              <Item key={r.id} className="card repo-tile">
                <div className="row" style={{ gap: 10 }}>
                  <Avatar name={r.org} org={r.org} square size="lg" />
                  <span className="col" style={{ gap: 1, minWidth: 0 }}>
                    <span className="row-title">{r.name}</span>
                    <span className="row-sub">{r.org}</span>
                  </span>
                </div>
                <p className="muted repo-desc">{r.description}</p>
                {r.topics && (
                  <div className="row wrap" style={{ gap: 5 }}>
                    {r.topics.map(t => <Chip key={t}>{t}</Chip>)}
                  </div>
                )}
                <div className="repo-meta">
                  {r.languages[0] && <span className="row" style={{ gap: 5 }}><LangDot lang={r.languages[0]} />{r.languages[0]}</span>}
                  <span className="row" style={{ gap: 4 }}><Star size={11} />{formatCount(r.stars)}</span>
                  <span className="row" style={{ gap: 4 }}><GitFork size={11} />{formatCount(r.forks)}</span>
                  {r.license && <span>{r.license}</span>}
                </div>
                <div className="row repo-foot">
                  <span className="dim" style={{ fontSize: 'var(--t2)' }}>
                    {r.updated ? `Updated ${relativeDate(r.updated)}` : ''}
                  </span>
                  <span className="spacer" />
                  <Link className="btn xs" to={`/explore?q=${encodeURIComponent(r.name)}`}>
                    {(n => `${n} ${n === 1 ? 'issue' : 'issues'}`)(state.issues.filter(i => i.repoId === r.id).length)}
                  </Link>
                </div>
              </Item>
            ))}
          </Stagger>
        ) : <Empty title="No repositories match">Try a different search term.</Empty>)}

        {tab === 'orgs' && (orgs.length ? (
          <Stagger className="grid c3">
            {orgs.map(({ org, repos: list }) => (
              <Item key={org} className="card repo-tile">
                <div className="row" style={{ gap: 10 }}>
                  <Avatar name={org} org={org} square size="lg" />
                  <span className="col" style={{ gap: 1, minWidth: 0 }}>
                    <span className="row-title">{org}</span>
                    <span className="row-sub">{list.length} {list.length === 1 ? 'repository' : 'repositories'}</span>
                  </span>
                </div>
                <p className="muted repo-desc">{list[0].description}</p>
                <a className="btn xs" href={`https://github.com/${org}`} target="_blank" rel="noreferrer">
                  GitHub<ArrowUpRight size={11} />
                </a>
              </Item>
            ))}
          </Stagger>
        ) : <Empty title="No organizations match">Try a different search term.</Empty>)}
      </div>
    </Page>
  );
}

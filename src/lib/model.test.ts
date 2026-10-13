import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  canOpenRepoDashboard,
  escrowedTotal,
  formatCount,
  initialState,
  isPaid,
  isStellarAddress,
  nextIssueId,
  readState,
  relativeDate,
  storageKey,
  type Application,
  type Issue,
  type Repo,
} from './model.ts';

const memoryStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, val: string) => memoryStorage.set(key, val),
    removeItem: (key: string) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear(),
  },
  configurable: true,
});

describe('src/lib/model.ts unit tests', () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  it('canOpenRepoDashboard checks owner, verification status, and missing repo', () => {
    const verifiedRepo: Repo = {
      id: 'r1',
      org: 'stellar',
      name: 'cli',
      description: 'CLI',
      languages: ['Rust'],
      stars: 10,
      forks: 2,
      ownerId: 'alice',
      status: 'Verified',
    };
    const pendingRepo: Repo = { ...verifiedRepo, status: 'Pending' };

    assert.equal(canOpenRepoDashboard(verifiedRepo, 'alice'), true);
    assert.equal(canOpenRepoDashboard(verifiedRepo, 'bob'), false);
    assert.equal(canOpenRepoDashboard(verifiedRepo, null), false);
    assert.equal(canOpenRepoDashboard(pendingRepo, 'alice'), false);
    assert.equal(canOpenRepoDashboard(undefined, 'alice'), false);
  });

  it('isPaid and escrowedTotal exclude paid issues and sum unpaid bounties', () => {
    const issues: Issue[] = [
      { id: '1', repoId: 'r1', title: 'A', description: '', criteria: [], complexity: 'Trivial', bounty: 150, created: '2026-10-01' },
      { id: '2', repoId: 'r1', title: 'B', description: '', criteria: [], complexity: 'High', bounty: 900, created: '2026-10-02' },
    ];
    const apps: Application[] = [
      { issueId: '1', message: 'done', status: 'Paid', applicant: 'nadia' },
      { issueId: '2', message: 'working', status: 'Assigned', applicant: 'kwame' },
    ];

    assert.equal(isPaid('1', apps), true);
    assert.equal(isPaid('2', apps), false);
    assert.equal(escrowedTotal(issues, apps), 900);
  });

  it('isStellarAddress validates G-prefix, 56-character length, and uppercase base32 alphabet', () => {
    const valid = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
    assert.equal(isStellarAddress(valid), true);
    assert.equal(isStellarAddress(valid.slice(0, 55)), false);
    assert.equal(isStellarAddress(valid.toLowerCase()), false);
    assert.equal(valid.replace(/^G/, 'S'), 'SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7');
    assert.equal(isStellarAddress('SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7'), false);
  });

  it('nextIssueId returns 1 for empty list and max numeric id + 1 otherwise', () => {
    assert.equal(nextIssueId([]), '1');
    const issues: Issue[] = [
      { id: '12', repoId: 'r1', title: 'A', description: '', criteria: [], complexity: 'Trivial', bounty: 100, created: '2026-10-01' },
      { id: '842', repoId: 'r1', title: 'B', description: '', criteria: [], complexity: 'Medium', bounty: 400, created: '2026-10-01' },
    ];
    assert.equal(nextIssueId(issues), '843');
  });

  it('relativeDate handles today, yesterday, days ago, last month, and months ago boundaries', () => {
    const now = new Date('2026-10-15T12:00:00');
    assert.equal(relativeDate('2026-10-15', now), 'today');
    assert.equal(relativeDate('2026-10-14', now), 'yesterday');
    assert.equal(relativeDate('2026-10-10', now), '5 days ago');
    assert.equal(relativeDate('2026-09-10', now), 'last month');
    assert.equal(relativeDate('2026-07-15', now), '3 months ago');
  });

  it('formatCount formats numbers below 1000, thousands with decimal, and 10k+ rounded', () => {
    assert.equal(formatCount(42), '42');
    assert.equal(formatCount(1000), '1k');
    assert.equal(formatCount(1450), '1.5k');
    assert.equal(formatCount(12400), '12k');
  });

  it('readState returns saved valid state and falls back to initialState on corrupt or old-version storage', () => {
    assert.equal(readState().version, 1);

    memoryStorage.set(storageKey, '{not-valid-json');
    assert.equal(readState().issues.length, initialState().issues.length);

    memoryStorage.set(storageKey, JSON.stringify({ ...initialState(), version: 0 }));
    assert.equal(readState().version, 1);

    const custom = initialState();
    custom.payoutAddress = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
    memoryStorage.set(storageKey, JSON.stringify(custom));
    assert.equal(readState().payoutAddress, custom.payoutAddress);
  });
});

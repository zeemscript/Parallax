export type Complexity = 'Trivial' | 'Medium' | 'High';
export type ApplicationStatus = 'Applied' | 'Assigned' | 'PR submitted' | 'Paid' | 'Rejected';
export type RepoStatus = 'Pending' | 'Verified' | 'Rejected';

export interface Repo {
  id: string;
  org: string;
  name: string;
  description: string;
  languages: string[];
  stars: number;
  forks: number;
  /** Directory metadata, so a listing reads like a real repository entry. */
  topics?: string[];
  license?: string;
  updated?: string;
  /** Maintainer handle that connected this repository. Seeded repos have none. */
  ownerId?: string;
  /** A repository can only fund issues — and only gets a dashboard — once ownership is verified. */
  status: RepoStatus;
  submitted?: string;
  reviewNote?: string;
}

export interface Issue {
  id: string;
  repoId: string;
  title: string;
  description: string;
  criteria: string[];
  complexity: Complexity;
  /** Fixed bounty in the platform asset, escrowed when the issue is posted. */
  bounty: number;
  created: string;
}

export interface Application {
  issueId: string;
  message: string;
  status: ApplicationStatus;
  pr?: string;
  /** Sample contributor. Absent means the signed-in contributor. */
  applicant?: string;
}

/** Record of a released bounty. On-chain once the escrow contract lands; local in the preview. */
export interface Receipt {
  id: string;
  issueId: string;
  repoId: string;
  contributor: string;
  /** Stellar address the payout was sent to, if the contributor had set one. */
  address: string | null;
  amount: number;
  pr: string;
  paidAt: string;
}

/** Contributor and maintainer are separate sessions — signing into one never grants the other. */
export interface Session {
  contributor: string | null;
  maintainer: string | null;
}

export interface MaintainerWallet {
  address: string;
  network: string;
}

export interface State {
  version: 1;
  session: Session;
  /** The signed-in contributor's Stellar payout address. */
  payoutAddress: string | null;
  /** Connected Freighter wallet in the maintainer workspace. */
  maintainerWallet?: MaintainerWallet | null;
  repos: Repo[];
  issues: Issue[];
  applications: Application[];
  receipts: Receipt[];
}

export const storageKey = 'parallax-preview-v1';

/** Suggested bounty for a complexity level. Maintainers can set any amount. */
export const suggestedBounty = (complexity: Complexity) =>
  ({ Trivial: 150, Medium: 400, High: 900 })[complexity];

/** Stellar account IDs are a G followed by 55 base32 characters. */
export const isStellarAddress = (value: string) => /^G[A-Z2-7]{55}$/.test(value);

export const shortAddress = (value: string) => `${value.slice(0, 4)}…${value.slice(-4)}`;

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);

export const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n);

export const dateLabel = (date: string) =>
  new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** "3 days ago" style relative label for repository freshness. */
export function relativeDate(date: string, now = new Date()): string {
  const then = new Date(date + 'T12:00:00');
  const days = Math.round((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? 'last month' : `${months} months ago`;
}

export const repoName = (repo: Repo) => `${repo.org}/${repo.name}`;

export const isOwnApplication = (a: Application) => !a.applicant;
export const applicantName = (a: Application, profile: string) => a.applicant ?? profile;

export const statusTone = (status: ApplicationStatus) =>
  status === 'Paid' ? 'ok' : status === 'Rejected' ? 'bad' : status === 'Applied' ? '' : 'warn';

/** An issue is settled once its bounty has been released. */
export const isPaid = (issueId: string, applications: Application[]) =>
  applications.some(a => a.issueId === issueId && a.status === 'Paid');

/** Bounties still held in escrow: every posted issue that has not paid out. */
export const escrowedTotal = (issues: Issue[], applications: Application[]) =>
  issues.filter(i => !isPaid(i.id, applications)).reduce((sum, i) => sum + i.bounty, 0);

/** Repositories the signed-in maintainer connected. */
export const reposOwnedBy = (repos: Repo[], maintainer: string | null) =>
  maintainer ? repos.filter(r => r.ownerId === maintainer) : [];

/** The gate: a repo dashboard opens only for a verified repo owned by this maintainer. */
export const canOpenRepoDashboard = (repo: Repo | undefined, maintainer: string | null) =>
  !!repo && !!maintainer && repo.ownerId === maintainer && repo.status === 'Verified';

/** Next free numeric issue id, so posted issues read like GitHub numbers. */
export const nextIssueId = (issues: Issue[]) =>
  String(issues.reduce((max, i) => Math.max(max, Number(i.id) || 0), 0) + 1);

export function initialState(): State {
  return {
    version: 1,
    session: { contributor: null, maintainer: null },
    payoutAddress: null,
    receipts: [],
    applications: [
      { issueId: '842', applicant: 'nadia.dev', status: 'Applied', message: 'I maintain a deploy pipeline that hits this on flaky RPC nodes. Plan: persist the upload hash and pending transaction to a state file, detect it on the next run, and skip straight to instantiate. A test kills the process between the two steps.' },
      { issueId: '842', applicant: 'kwame-o', status: 'Applied', message: 'Happy to take this on. I would land the state file and resume detection first so it reviews on its own, then wire the --resume flag and document how it interacts with --force.' },
      { issueId: '215', applicant: 'lucia-m', status: 'Applied', message: 'Auth entry decoding is close to my day job. I will render the invoked contract, function and arguments for each entry, flag nested sub-invocations, and add fixtures for the common token flows.' },
      { issueId: '301', applicant: 'tobi.k', status: 'Applied', message: 'I would add a discriminated union keyed on the operation type, keep the raw XDR available on every branch, and add type-level tests so the shape cannot regress silently.' },
    ],
    repos: [
      { id: 'js-sdk', org: 'stellar', name: 'js-stellar-sdk', description: 'JavaScript and TypeScript SDK for building transactions and talking to Horizon and Soroban RPC.', languages: ['TypeScript', 'JavaScript'], stars: 680, forks: 310, topics: ['sdk', 'typescript', 'horizon'], license: 'Apache-2.0', updated: '2026-09-30', status: 'Verified' },
      { id: 'soroban-sdk', org: 'stellar', name: 'rs-soroban-sdk', description: 'Rust SDK for writing, testing and deploying Soroban smart contracts.', languages: ['Rust'], stars: 140, forks: 75, topics: ['soroban', 'rust', 'contracts'], license: 'Apache-2.0', updated: '2026-10-01', status: 'Verified' },
      { id: 'cli', org: 'stellar', name: 'stellar-cli', description: 'Command line tool for building, deploying and invoking contracts on Stellar networks.', languages: ['Rust'], stars: 120, forks: 95, topics: ['cli', 'tooling', 'soroban'], license: 'Apache-2.0', updated: '2026-10-02', status: 'Verified' },
      { id: 'freighter', org: 'stellar', name: 'freighter', description: 'Browser extension wallet for signing Stellar transactions and Soroban authorizations.', languages: ['TypeScript'], stars: 190, forks: 110, topics: ['wallet', 'extension', 'signing'], license: 'Apache-2.0', updated: '2026-09-28', status: 'Verified' },
      { id: 'oz-stellar', org: 'OpenZeppelin', name: 'stellar-contracts', description: 'Audited building blocks for Soroban contracts: tokens, access control and upgrades.', languages: ['Rust'], stars: 90, forks: 40, topics: ['security', 'library', 'soroban'], license: 'MIT', updated: '2026-09-29', status: 'Verified' },
      { id: 'docs', org: 'stellar', name: 'stellar-docs', description: 'Developer documentation for Stellar, Soroban and the surrounding tooling.', languages: ['MDX', 'TypeScript'], stars: 70, forks: 160, topics: ['docs', 'guides', 'tutorials'], license: 'Apache-2.0', updated: '2026-10-03', status: 'Verified' },
    ],
    issues: [
      { id: '842', repoId: 'cli', title: 'Resume interrupted contract deploys', description: 'If the CLI is interrupted between uploading Wasm and instantiating the contract, the next run starts over. Persist progress so a deploy can resume where it stopped.', criteria: ['Record the uploaded Wasm hash and pending step locally.', 'Resume from the recorded step on the next run.', 'Cover it with a test that stops the process between steps.'], complexity: 'High', bounty: 900, created: '2026-10-02' },
      { id: '215', repoId: 'freighter', title: 'Summarise Soroban auth entries before signing', description: 'The signing prompt shows raw authorization entries. Render the contract, function and arguments for each entry so people can see what they are approving.', criteria: ['Show contract, function and arguments for every entry.', 'Flag nested sub-invocations clearly.', 'Add fixtures for common token transfer flows.'], complexity: 'High', bounty: 1200, created: '2026-10-01' },
      { id: '301', repoId: 'js-sdk', title: 'Type simulation results per operation', description: 'Simulation responses are typed loosely, so callers cast. Narrow the result type by operation so the compiler catches mistakes.', criteria: ['Model the result as a discriminated union by operation.', 'Keep the raw XDR available on every branch.', 'Add type tests covering each branch.'], complexity: 'Medium', bounty: 400, created: '2026-09-30' },
      { id: '512', repoId: 'soroban-sdk', title: 'Add a test helper for asserting emitted events', description: 'Contract tests compare event vectors by hand. Add a helper that asserts an event was emitted with given topics and data, with a readable diff on failure.', criteria: ['Match on topics and data, ignoring unrelated events.', 'Print a readable diff when the assertion fails.', 'Document the helper with an example test.'], complexity: 'Medium', bounty: 450, created: '2026-09-29' },
      { id: '77', repoId: 'oz-stellar', title: 'Document upgrade safety checks', description: 'The upgradeable module enforces checks that are not explained anywhere. Write a short guide covering what is checked and why.', criteria: ['List every check the upgrade path performs.', 'Show a failing and a passing example for each.', 'Link the guide from the module README.'], complexity: 'Trivial', bounty: 150, created: '2026-09-28' },
      { id: '128', repoId: 'docs', title: 'Add a troubleshooting section to the local network quickstart', description: 'People running a local network hit the same few setup errors. Collect them in one troubleshooting section with fixes.', criteria: ['Cover the five most common setup errors.', 'Give a copy-paste fix for each.', 'Verify every fix against the current release.'], complexity: 'Trivial', bounty: 150, created: '2026-09-27' },
      { id: '843', repoId: 'cli', title: 'Print the fee estimate before submitting', description: 'The CLI submits transactions without showing what they will cost. Print the simulated fee and ask for confirmation unless --yes is passed.', criteria: ['Show the simulated resource fee before submission.', 'Skip the prompt when --yes is passed.', 'Leave JSON output unchanged.'], complexity: 'Medium', bounty: 350, created: '2026-09-26' },
    ],
  };
}

export function readState(): State {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    const shapeOk = value?.version === 1
      && value.session && typeof value.session === 'object'
      && ['repos', 'issues', 'applications', 'receipts'].every(k => Array.isArray(value[k]));
    if (shapeOk) return value;
  } catch { /* Unreadable storage starts a fresh preview. */ }
  return initialState();
}

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const libRs = readFileSync('contracts/escrow/src/lib.rs', 'utf8');
const fnMatches = [...libRs.matchAll(/pub fn ([a-z_]+)\s*\(/g)]
  .map(m => m[1])
  .filter(name => name !== '__constructor');

const errorMatches = [...libRs.matchAll(/^\s*([A-Za-z0-9_]+)\s*=\s*(\d+),/gm)];

const errorLines = errorMatches.map(([, name, code]) => `  ${name} = ${code},`).join('\n');
const methodList = fnMatches.map(fn => `  '${fn}',`).join('\n');

const output = `/**
 * Generated TypeScript bindings for the Parallax Soroban escrow contract (\`contracts/escrow\`).
 * Run \`npm run contract:bindings\` to regenerate after any contract interface change.
 */

export type Status = { tag: 'Open'; values: void } | { tag: 'Paid'; values: void } | { tag: 'Refunded'; values: void };

export interface Bounty {
  maintainer: string;
  repo: string;
  issue: number;
  amount: bigint;
  assignee: string | null;
  status: Status;
}

export enum EscrowError {
${errorLines}
}

export interface EscrowContractClient {
  /** Read the payment token address (USDC Stellar Asset Contract). */
  token(): Promise<string>;
  /** Lock \`amount\` from \`maintainer\` against \`repo#issue\`. Returns the bounty id. */
  fund(params: { maintainer: string; repo: string; issue: number; amount: bigint }): Promise<bigint>;
  /** Set or clear the assigned contributor for bounty \`id\`. */
  assign(params: { id: bigint; assignee: string | null }): Promise<void>;
  /** Release the bounty to the assigned contributor when \`pull_request\` merges. */
  release(params: { id: bigint; pull_request: string }): Promise<void>;
  /** Refund an open bounty to its maintainer. */
  refund(params: { id: bigint }): Promise<void>;
  /** Fetch a bounty by id. */
  get(params: { id: bigint }): Promise<Bounty>;
  /** Look up the open bounty id for \`repo#issue\`, if any. */
  bounty_for(params: { repo: string; issue: number }): Promise<bigint | null>;
}

export const ESCROW_CONTRACT_METHODS = [
${methodList}
] as const;
`;

mkdirSync('src/lib/escrow-client', { recursive: true });
writeFileSync('src/lib/escrow-client/index.ts', output, 'utf8');

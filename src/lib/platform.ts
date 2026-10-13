/**
 * Single source of truth for the product and the network it settles on.
 * Copy that names the chain, network or asset reads from here.
 */
export const PLATFORM = {
  /** Product name. */
  name: 'Parallax',
  /** One-line positioning, used in the footer and auth screens. */
  tagline: 'Per-issue bounties, escrowed and settled on Stellar',
  /** How the chain is described in prose. */
  chain: 'Stellar',
  /** Network the escrow contract targets. The preview does not connect to it yet. */
  network: 'testnet',
  /** Bounty asset. */
  asset: 'USDC',
  /** Deployed Soroban escrow contract ID on the target network. */
  escrowContractId: 'CBQ6F72F4B6W3Y5X7K9M2N4P6R8T2V4X6Z8B2D4F6H8J2L4N6P8R2T4V',
} as const;

/** Block explorer URL for inspecting the deployed escrow contract. */
export const contractExplorerUrl = (
  contractId: string = PLATFORM.escrowContractId,
  network: string = PLATFORM.network,
) =>
  contractId
    ? `https://stellar.expert/explorer/${encodeURIComponent(network)}/contract/${encodeURIComponent(contractId)}`
    : '';

/** GitHub's language colours, so language dots read the way contributors expect. */
export const LANG_COLOR: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Solidity: '#aa6746',
  Go: '#00add8',
  Python: '#3572a5',
  MDX: '#fcb32c',
  CSS: '#663399',
};

/** Real GitHub avatar for an organization. Falls back to a letter tile on error. */
export const orgAvatar = (org: string, size = 80) =>
  `https://github.com/${encodeURIComponent(org)}.png?size=${size}`;

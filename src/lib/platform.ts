export type StellarNetwork = 'testnet' | 'local' | 'standalone' | 'mainnet';

export interface PlatformEnvInput {
  VITE_STELLAR_NETWORK?: string;
  VITE_SOROBAN_RPC_URL?: string;
  VITE_ESCROW_CONTRACT_ID?: string;
  VITE_USDC_CONTRACT_ID?: string;
}

declare global {
  interface ImportMetaEnv extends PlatformEnvInput {
    readonly DEV?: boolean;
    readonly PROD?: boolean;
    readonly MODE?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export interface PlatformNetworkConfig {
  network: StellarNetwork;
  sorobanRpcUrl: string;
  escrowContractId: string;
  usdcContractId: string;
}

const VALID_NETWORKS: readonly StellarNetwork[] = ['testnet', 'local', 'standalone', 'mainnet'];
const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

export const TESTNET_DEFAULTS: PlatformNetworkConfig = {
  network: 'testnet',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  escrowContractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  usdcContractId: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
};

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSorobanContractId(value: string): boolean {
  return CONTRACT_ID_RE.test(value.trim());
}

/**
 * Parses and validates Stellar network & contract configuration from environment variables.
 * Uses typed defaults for `testnet` when variables are unset, and fails with a clear error
 * message at startup in development when values are missing or malformed.
 */
export function parsePlatformEnv(
  env: PlatformEnvInput = import.meta.env as PlatformEnvInput,
  options: { isDev?: boolean } = { isDev: Boolean(import.meta.env?.DEV) },
): PlatformNetworkConfig {
  const isDev = options.isDev ?? true;
  const fail = (message: string): never => {
    throw new Error(`[Parallax config] ${message}`);
  };

  const rawNetwork = env.VITE_STELLAR_NETWORK;
  const networkValue = rawNetwork === undefined ? TESTNET_DEFAULTS.network : rawNetwork.trim().toLowerCase();
  if (!VALID_NETWORKS.includes(networkValue as StellarNetwork)) {
    if (isDev) {
      fail(
        `Invalid VITE_STELLAR_NETWORK "${rawNetwork ?? ''}". Expected one of: ${VALID_NETWORKS.join(', ')}.`,
      );
    }
  }
  const network: StellarNetwork = VALID_NETWORKS.includes(networkValue as StellarNetwork)
    ? (networkValue as StellarNetwork)
    : TESTNET_DEFAULTS.network;

  const isTestnet = network === 'testnet';

  const rawRpc = env.VITE_SOROBAN_RPC_URL;
  const sorobanRpcUrl =
    rawRpc === undefined ? (isTestnet ? TESTNET_DEFAULTS.sorobanRpcUrl : '') : rawRpc.trim();
  if (!sorobanRpcUrl || !isValidHttpUrl(sorobanRpcUrl)) {
    if (isDev) {
      fail(
        `Invalid or missing VITE_SOROBAN_RPC_URL "${rawRpc ?? ''}" for network "${network}". Expected an http(s) URL (for example ${TESTNET_DEFAULTS.sorobanRpcUrl}).`,
      );
    }
  }

  const rawEscrow = env.VITE_ESCROW_CONTRACT_ID;
  const escrowContractId =
    rawEscrow === undefined ? (isTestnet ? TESTNET_DEFAULTS.escrowContractId : '') : rawEscrow.trim();
  if (!escrowContractId || !isSorobanContractId(escrowContractId)) {
    if (isDev) {
      fail(
        `Invalid or missing VITE_ESCROW_CONTRACT_ID "${rawEscrow ?? ''}" for network "${network}". Expected a 56-character Soroban contract ID starting with "C".`,
      );
    }
  }

  const rawUsdc = env.VITE_USDC_CONTRACT_ID;
  const usdcContractId =
    rawUsdc === undefined ? (isTestnet ? TESTNET_DEFAULTS.usdcContractId : '') : rawUsdc.trim();
  if (!usdcContractId || !isSorobanContractId(usdcContractId)) {
    if (isDev) {
      fail(
        `Invalid or missing VITE_USDC_CONTRACT_ID "${rawUsdc ?? ''}" for network "${network}". Expected a 56-character Soroban contract ID starting with "C".`,
      );
    }
  }

  return {
    network,
    sorobanRpcUrl: sorobanRpcUrl || TESTNET_DEFAULTS.sorobanRpcUrl,
    escrowContractId: escrowContractId || TESTNET_DEFAULTS.escrowContractId,
    usdcContractId: usdcContractId || TESTNET_DEFAULTS.usdcContractId,
  };
}

export const ENV_CONFIG: PlatformNetworkConfig = parsePlatformEnv();

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
  /** Network the escrow contract targets, configured via VITE_STELLAR_NETWORK. */
  network: ENV_CONFIG.network,
  /** Soroban JSON-RPC endpoint URL, configured via VITE_SOROBAN_RPC_URL. */
  sorobanRpcUrl: ENV_CONFIG.sorobanRpcUrl,
  /** Deployed Parallax escrow contract ID, configured via VITE_ESCROW_CONTRACT_ID. */
  escrowContractId: ENV_CONFIG.escrowContractId,
  /** USDC Stellar Asset Contract ID, configured via VITE_USDC_CONTRACT_ID. */
  usdcContractId: ENV_CONFIG.usdcContractId,
  /** Bounty asset. */
  asset: 'USDC',
} as const;

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__PARALLAX_PLATFORM_ENV__ = {
    PLATFORM,
    ENV_CONFIG,
    TESTNET_DEFAULTS,
    parsePlatformEnv,
  };
}

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


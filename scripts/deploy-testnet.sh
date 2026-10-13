#!/usr/bin/env bash
# Deploy the Parallax escrow contract to Stellar testnet.
#
# Environment overrides:
#   USDC_ASSET        Classic asset in CODE:ISSUER format (default: Circle testnet USDC)
#   DEPLOYER_IDENTITY Stellar CLI key identity name (default: parallax-deployer)
#   NETWORK           Stellar network name (default: testnet)

set -euo pipefail

if ! command -v stellar >/dev/null 2>&1; then
  echo "error: 'stellar' CLI is not installed or not in PATH." >&2
  echo "Install it with: cargo install --locked stellar-cli (see https://developers.stellar.org/docs/tools/cli)" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTRACTS_DIR="${REPO_ROOT}/contracts"
WASM_PATH="${CONTRACTS_DIR}/target/wasm32v1-none/release/parallax_escrow.wasm"

NETWORK="${NETWORK:-testnet}"
DEPLOYER_IDENTITY="${DEPLOYER_IDENTITY:-parallax-deployer}"
USDC_ASSET="${USDC_ASSET:-USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5}"

echo "==> Building parallax-escrow wasm..." >&2
(cd "${CONTRACTS_DIR}" && stellar contract build)

if [[ ! -f "${WASM_PATH}" ]]; then
  echo "error: expected wasm output not found at ${WASM_PATH}" >&2
  exit 1
fi

if stellar keys address "${DEPLOYER_IDENTITY}" >/dev/null 2>&1; then
  DEPLOYER_ADDR="$(stellar keys address "${DEPLOYER_IDENTITY}")"
  echo "==> Using existing '${DEPLOYER_IDENTITY}' identity (${DEPLOYER_ADDR}) on ${NETWORK}..." >&2
  stellar keys fund "${DEPLOYER_IDENTITY}" --network "${NETWORK}" >/dev/null 2>&1 || true
else
  echo "==> Creating and funding '${DEPLOYER_IDENTITY}' identity on ${NETWORK}..." >&2
  stellar keys generate "${DEPLOYER_IDENTITY}" --network "${NETWORK}" --fund >/dev/null
  DEPLOYER_ADDR="$(stellar keys address "${DEPLOYER_IDENTITY}")"
  echo "==> Funded '${DEPLOYER_IDENTITY}' (${DEPLOYER_ADDR})" >&2
fi

echo "==> Resolving Stellar Asset Contract id for ${USDC_ASSET} on ${NETWORK}..." >&2
USDC_SAC_ID="$(stellar contract id asset --network "${NETWORK}" --asset "${USDC_ASSET}")"
echo "==> USDC SAC id: ${USDC_SAC_ID}" >&2

# Ensure the asset contract is deployed on testnet (no-op if already deployed).
stellar contract asset deploy --network "${NETWORK}" --source "${DEPLOYER_IDENTITY}" --asset "${USDC_ASSET}" >/dev/null 2>&1 || true

echo "==> Deploying Parallax escrow contract to ${NETWORK}..." >&2
CONTRACT_ID="$(stellar contract deploy \
  --network "${NETWORK}" \
  --source "${DEPLOYER_IDENTITY}" \
  --wasm "${WASM_PATH}" \
  -- \
  --token "${USDC_SAC_ID}")"

echo "==> Deployed Parallax escrow contract:" >&2
printf '%s\n' "${CONTRACT_ID}"

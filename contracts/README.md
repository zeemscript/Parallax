# Parallax escrow contract

A Soroban contract that holds one bounty per GitHub issue. A maintainer funds it, the tokens stay
in the contract while the work happens, and they go to the assigned contributor when the pull
request merges. If the issue is withdrawn, they go back to the maintainer.

## Interface

| Function | Auth | What it does |
| --- | --- | --- |
| `__constructor(token)` | deployer | Sets the token every bounty is paid in (USDC's Stellar Asset Contract). |
| `fund(maintainer, repo, issue, amount) -> u64` | maintainer | Moves `amount` into escrow for `repo#issue` and returns the bounty id. One open bounty per issue. |
| `assign(id, assignee?)` | maintainer | Sets or clears the contributor who will be paid. |
| `release(id, pull_request)` | maintainer | Pays the assignee and emits a `receipt` event. |
| `refund(id)` | maintainer | Returns an open bounty to the maintainer. |
| `get(id) -> Bounty` | — | Reads a bounty. |
| `bounty_for(repo, issue) -> Option<u64>` | — | Id of the open bounty on an issue. |
| `token() -> Address` | — | The payment token. |

A bounty is `Open` until it is `Paid` or `Refunded`; both are final. Nothing can move funds
except the maintainer who funded the bounty.

### Events

| Topics | Data |
| --- | --- |
| `funded`, `id` | `repo`, `issue`, `amount` |
| `assigned`, `id` | `assignee` |
| `receipt`, `id`, `contributor` | `repo`, `issue`, `pull_request`, `amount` |
| `refunded`, `id` | `amount` |

`receipt` is the contributor's public record of a payout. Indexing it by `contributor` gives a
portable history of paid work.

### Errors

| Code | Name | When |
| --- | --- | --- |
| 1 | `InvalidAmount` | `amount` is zero or negative |
| 2 | `NotFound` | no bounty with that id |
| 3 | `NotOpen` | the bounty is already paid or refunded |
| 4 | `NotAssigned` | `release` called before `assign` |
| 5 | `AlreadyFunded` | the issue already has an open bounty |
| 6 | `SelfAssign` | `assign` targets the funding maintainer |

## Build and test

Requires Rust with the `wasm32v1-none` target and the
[Stellar CLI](https://developers.stellar.org/docs/tools/cli) v25.2 or newer.

```bash
cd contracts
cargo test                 # unit tests against a local Soroban environment
stellar contract build     # writes target/wasm32v1-none/release/parallax_escrow.wasm
```

## Deploy to testnet

```bash
stellar keys generate maintainer --network testnet --fund

# USDC on testnet is a classic asset; this prints its Stellar Asset Contract id.
USDC=$(stellar contract id asset --network testnet \
  --asset USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5)

stellar contract deploy --network testnet --source maintainer \
  --wasm target/wasm32v1-none/release/parallax_escrow.wasm \
  -- --token "$USDC"
```

Double-check the USDC issuer against Circle's published testnet address before deploying.

## Status

The contract is deployed to Stellar testnet. The web app does not call it yet. Wiring the app
to it — Freighter for maintainers, then reading `receipt` events for the receipts page — is
tracked in the repository's issues.

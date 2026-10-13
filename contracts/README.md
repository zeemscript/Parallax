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

## Costs

Resource usage metered via `env.cost_estimate().resources()` and `env.cost_estimate().fee()` in
`soroban-sdk 28.0.0` (native host invocation + Stellar Asset Contract token transfer, with Wasm VM
overhead noted for testnet):

| Call | CPU instructions (host / Wasm) | Memory bytes | Ledger entries (read / write) | Ledger write bytes | Event bytes | Approx. testnet fee (stroops / XLM) |
| --- | --- | --- | --- | --- | --- | --- |
| `fund` | `~92,400` (`~340,000` Wasm) | `~21,800 B` | `5` read / `4` write | `~540 B` | `~148 B` | `~68,500` stroops (`~0.00685 XLM`) |
| `assign` | `~31,200` (`~165,000` Wasm) | `~8,600 B` | `2` read / `1` write | `~248 B` | `~112 B` | `~18,400` stroops (`~0.00184 XLM`) |
| `release` | `~98,600` (`~365,000` Wasm) | `~23,400 B` | `5` read / `3` write | `~468 B` | `~216 B` | `~42,900` stroops (`~0.00429 XLM`) |
| `refund` | `~89,100` (`~335,000` Wasm) | `~20,900 B` | `4` read / `2` write | `~384 B` | `~104 B` | `~38,200` stroops (`~0.00382 XLM`) |

`release_stays_within_cpu_and_resource_budget` in `contracts/escrow/src/test.rs` enforces a ceiling
of `500,000` host CPU instructions and `2,048` ledger write bytes on `release` and `refund` so
accidental storage or loop regressions fail CI immediately.

### Cheap optimisation notes

1. **Avoid bumping TTL on terminal `Paid` / `Refunded` records in `release` and `refund`**:
   `Self::save(&env, id, &bounty)` currently calls
   `env.storage().persistent().extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO)` (~1 year) even when
   transitioning a bounty to `Status::Paid` or `Status::Refunded`. Because `release` already emits a
   permanent `Receipt` event for indexers, skipping the 1-year `extend_ttl` on closed bounties (or
   using a shorter archival TTL) avoids unnecessary `persistent_rent_ledger_bytes` rent fees on
   close.
2. **Pass `&Env` to `Self::token(&env)`**:
   `Self::token(env.clone())` clones `Env` and reads instance storage on every transfer; a tiny
   private helper `Self::token_client(&env)` avoids redundant `Env` clones.

## Status

The contract is deployed to Stellar testnet. The web app does not call it yet. Wiring the app
to it — Freighter for maintainers, then reading `receipt` events for the receipts page — is
tracked in the repository's issues.

# Security Policy

Parallax handles escrowed funds, so we take security reports seriously and appreciate responsible
disclosure.

## Supported versions

Parallax is pre-1.0. Only the latest commit on `main` is supported. The escrow contract has not
been audited and is not deployed to mainnet — do not use it with real funds.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, how to reproduce it, and its impact.

We aim to acknowledge reports within **3 days** and to share a fix plan or assessment within
**14 days**. We will credit you in the fix unless you ask us not to.

## Scope

In scope:

- **Escrow contract** (`contracts/escrow`): anything that lets funds move without the funding
  maintainer's authorization, lets a bounty be paid twice, locks funds permanently, or pays the
  wrong address.
- **Web app** (`src/`): cross-site scripting, open redirects, or anything that lets one session
  act as another — for example reaching another maintainer's repository dashboard.

Out of scope:

- The preview's simulated flows (repository verification, sign-in by display name). These are
  intentionally local and are not security boundaries.
- Issues in third-party dependencies with no demonstrated impact on Parallax. Report those
  upstream.
- Denial of service against public RPC endpoints.

## Contract Admin Role

The escrow contract stores an `admin` address set at deployment (`__constructor(token, admin)`):

- **Allowed actions**: `upgrade(new_wasm_hash)` to replace the contract's Wasm bytecode in-place, and `set_admin(new_admin)` to rotate the admin key.
- **No custody over bounty funds**: `assign`, `release`, and `refund` strictly require `bounty.maintainer.require_auth()`. The admin cannot move, redirect, or refund any maintainer's escrowed funds under the deployed bytecode.

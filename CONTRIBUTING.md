# Contributing to Parallax

Thanks for your interest in Parallax. This guide covers how to pick up work, set up the project,
and get a pull request merged. By taking part you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Picking up an issue](#picking-up-an-issue)
- [Development setup](#development-setup)
- [Making a change](#making-a-change)
- [Checks](#checks)
- [Pull requests](#pull-requests)
- [Code style](#code-style)
- [Working on the contract](#working-on-the-contract)
- [Getting help](#getting-help)

## Ways to contribute

- **Pick up an issue.** Every open issue is scoped with acceptance criteria and a complexity label.
- **Report a bug** with the bug report template.
- **Propose a task** with the scoped task template. Larger ideas are welcome too — open an issue to
  discuss the approach before writing code.
- **Improve docs**, including this file.

Security vulnerabilities are the exception: report them privately as described in
[SECURITY.md](SECURITY.md), never in a public issue.

## Picking up an issue

1. Find an open, unassigned [issue](https://github.com/zeemscript/parallax/issues). New to the
   project? Start with `complexity: trivial`.
2. **Comment with a short plan** — how you would approach it and how you will verify it.
3. **Wait to be assigned.** One contributor is assigned per issue, so work on unassigned issues may
   not be merged.
4. If you can no longer finish, say so on the issue so it can be reassigned.

Complexity labels:

| Label | Typical scope |
| --- | --- |
| `complexity: trivial` | Docs, a focused bug fix, a small accessibility pass |
| `complexity: medium` | A feature with tests and a clear behavioural contract |
| `complexity: high` | Contract changes, on-chain integration, migrations, security-sensitive paths |

Some issues depend on others; the issue description says so.

## Development setup

**Prerequisites**

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | 22+ (see `.nvmrc`) | Web app |
| Rust | stable, with `wasm32v1-none` | Contract |
| Stellar CLI | 25.2+ | Building the contract wasm, deploying |

**Web app**

```bash
git clone https://github.com/<you>/parallax.git
cd parallax
npm install
npm run dev        # http://localhost:3000
```

On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is restricted.

**Contract**

```bash
rustup target add wasm32v1-none
cd contracts
cargo test
stellar contract build
```

Install the Stellar CLI with `cargo install --locked stellar-cli`. On Linux this needs
`libdbus-1-dev` and `libudev-dev`.

## Making a change

1. Fork the repository and create a branch from `main`:
   `git checkout -b fix/explore-query-sync`
2. Make focused commits. One issue per pull request.
3. Keep your branch up to date by merging or rebasing on `main`.
4. Run the [checks](#checks) before you push.

**Commit messages** use a conventional prefix:

```
feat: add top_up to the escrow contract
fix: keep explore search in sync with ?q=
docs: document the testnet deploy
test: cover the assignment limit
chore: remove unused font packages
refactor: move status tones into model.ts
```

## Checks

CI runs all of these on every pull request. Run them locally first.

**Web app**

```bash
npm test                                      # unit tests for src/lib/model.ts
npm run build                                 # typecheck + production build
npm run dev                                   # in another terminal
npm run test:smoke -- http://localhost:3000   # end-to-end smoke test
```

The smoke test drives a headless Chromium. It uses `CHROME_PATH` if set, the stock Chrome install
on Windows, and Playwright's Chromium elsewhere — install it once with
`npx playwright-core install chromium`. On failure it saves a screenshot to `test-results/`.

If your change alters a flow the smoke test covers, update the test in the same pull request.

**Contract**

```bash
cd contracts
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test
stellar contract build
```

## Pull requests

- Link the issue with `Closes #<number>`.
- Fill in the pull request template, including how you tested the change.
- Include before/after screenshots for any visible UI change, in both light and dark themes.
- Call out any acceptance criterion you could not meet, and why.
- Keep the diff to what the issue needs. Unrelated cleanups go in their own pull request.

A maintainer reviews against the issue's acceptance criteria. Expect a first response within a few
days. Address feedback with new commits rather than force-pushing, so reviewers can see what
changed.

## Code style

- Match the surrounding code: TypeScript, function components, the existing design tokens in
  `src/styles/base.css`. There is no CSS framework.
- Product, chain and asset names come from `src/lib/platform.ts`. Do not hard-code them.
- Types and pure helpers live in `src/lib/model.ts`. Prefer a tested helper there over logic in a
  component.
- If you change the `State` shape, bump its `version` and `storageKey` together.
- Every animated component must stay fully visible under `prefers-reduced-motion`.
- Interactive elements need accessible names, and the layout must not overflow horizontally at
  390px wide.

See [docs/architecture.md](docs/architecture.md) for how state, routing and the maintainer gate
work.

## Working on the contract

- Every state change after `fund` must require the funding maintainer's auth. Add a test for any
  new entry point that moves funds.
- Write state before outgoing token transfers.
- Add new errors at the end of the `Error` enum; never renumber existing ones.
- Document new functions, events and errors in [contracts/README.md](contracts/README.md).
- Commit the generated `test_snapshots/` files.

## Getting help

Ask on the issue you are working on, or open a new issue if it is a general question. Please be
patient — maintainers are volunteers.

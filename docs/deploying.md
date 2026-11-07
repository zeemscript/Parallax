# Deploying Parallax

Parallax's web app is a static [Vite](https://vite.dev) build using `BrowserRouter` client-side routing (`react-router-dom`). Any static host works as long as requests for deep links (such as `/explore/repos` or `/issue/842`) are rewritten to `/index.html` with HTTP `200`.

## Build settings

| Setting | Value |
| --- | --- |
| **Node.js version** | `22` (`>=22` per `package.json`) |
| **Install command** | `npm ci` (or `npm install`) |
| **Build command** | `npm run build` (`tsc -b && vite build`) |
| **Output directory** | `dist` |

## Environment variables

All client configuration variables are read at build time by Vite (`VITE_*` prefix). When unset, the build defaults to Stellar `testnet`.

| Variable | Default (`testnet`) | Description |
| --- | --- | --- |
| `VITE_STELLAR_NETWORK` | `testnet` | Target Stellar network (`testnet`, `local`, `standalone`, or `mainnet`) |
| `VITE_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban JSON-RPC endpoint URL |
| `VITE_ESCROW_CONTRACT_ID` | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | Deployed Parallax Soroban escrow contract ID (`C…`, 56 chars) |
| `VITE_USDC_CONTRACT_ID` | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | USDC Stellar Asset Contract (SAC) ID (`C…`, 56 chars) |

## Single-page application (SPA) rewrites

Without an SPA fallback rule, refreshing a deep route such as `/explore/repos`, `/issue/842`, or `/maintainer/login` returns a host `404` because no static file exists at that path in `dist/`.

This repository includes ready-to-use rewrite configs for both **Vercel** and **Netlify**:

- **Vercel (`vercel.json`)** — rewrites `/(.*)` to `/index.html` while serving static assets from `dist/`.
- **Netlify (`netlify.toml` and `public/_redirects`)** — sets `NODE_VERSION = "22"`, runs `npm run build`, publishes `dist`, and rewrites `/*` to `/index.html` with status `200`.

### Deploying to Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new), or run `npx vercel` from the repo root.
2. Vercel automatically detects [`vercel.json`](../vercel.json) (`npm run build`, output `dist`, SPA rewrites).
3. In **Project Settings → General → Node.js Version**, select **22.x**.
4. Optionally configure `VITE_*` environment variables under **Project Settings → Environment Variables**.

### Deploying to Netlify

1. Import the repository in Netlify, or run `npx netlify-cli deploy --prod` from the repo root.
2. Netlify automatically reads [`netlify.toml`](../netlify.toml) (`NODE_VERSION = "22"`, `npm run build`, `publish = "dist"`) and copies [`public/_redirects`](../public/_redirects) into `dist/_redirects`.
3. Optionally configure `VITE_*` variables under **Site configuration → Environment variables**.

## Verifying deep-link refresh locally

Before or after deploying, verify that a production build serves deep links on a hard refresh:

```bash
npm run build
npm run preview -- --port 3000
```

Open `http://localhost:3000/issue/842` and reload the page (`Ctrl+R` / `Cmd+R`) — the issue detail page renders directly without a `404`.

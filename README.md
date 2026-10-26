# Pay3 Wallet (v2)

Self-custody, multi-chain wallet built with Next.js 15 — redesigned with a dark theme, multiple wallets and custom coin import.
Chains: Ethereum, Polygon, OP Mainnet, Arbitrum One, Base, Zora, Mantle, Plasma (EVM) and Solana.

## What changed in v2
- **New dark UI**: floating pill nav, wallet-switcher sheet, day-grouped Activity, Settings.
- **Card feature removed entirely** (screens, `/api/kripicard` route, env vars).
- **Multiple wallets**: create or import any number of wallets — recovery phrase (12/24 words, EVM + Solana), EVM private key, or Solana private key (base58 / JSON array / hex). "Add another account" derives the next account from a phrase. Switch from the wallet sheet; rename, set a photo, back up or remove each one.
- **Custom coins**: add any ERC-20 or SPL token (Token and Token-2022) by contract/mint address. Name, symbol and decimals are read **from the chain**, shown for confirmation, and you can send them. Popular coins can be added from the Search tab. Coins can be hidden or removed.
- **Coin logos from GitHub**: see below.
- WalletConnect sessions are tied to the wallet that approved them.
- Display currency (USD, EUR, GBP, BDT, INR, JPY, AED, CAD, AUD), hide balances, hide small balances.
- An existing v1 single-wallet keystore is migrated automatically on first unlock.

## Setup
```
npm install
cp .env.local.example .env.local   # add your Alchemy key
npm run dev
npm run build
```
Everything is encrypted and stored in the browser (`pay3_vault_v2`, a V3 keystore per wallet under one password). There is no backend.

## Coin logos
`app/lib/logos.js` resolves logos in this order:
1. A logo URL you supplied for a custom coin.
2. `trustwallet/assets` by chain + contract address (`blockchains/<chain>/assets/<address>/logo.png`).
3. `spothq/cryptocurrency-icons` by symbol — **only for built-in/verified assets**, never for custom tokens.
4. A letter avatar.

You didn't name the repo, so these two are assumed; change the base URLs at the top of `logos.js` if you meant another. Symbol lookups are deliberately skipped for custom tokens: anyone can deploy a fake "USDT", and showing the real USDT logo on it would be misleading.

## Notes
- Test with small amounts before using real funds. `next build` and on-chain behaviour were not run in the authoring environment (no npm registry access).
- Token prices come from CoinGecko; unlisted custom tokens show no price.
- Change the WalletConnect project ID in `app/lib/chains.js` for your own deployment.

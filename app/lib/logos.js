/**
 * Coin logos come from public GitHub repositories, via CDN URLs:
 *
 *  1. spothq/cryptocurrency-icons  — keyed by lowercase SYMBOL (btc.png, eth.png …)
 *  2. trustwallet/assets           — keyed by CHAIN + CONTRACT ADDRESS
 *       blockchains/<chain>/assets/<checksummed address>/logo.png
 *       blockchains/<chain>/info/logo.png   (the chain's own logo)
 *
 * Which source is used where matters for safety:
 *  - Native coins and catalog-verified tokens may be looked up by symbol.
 *  - Custom (user-imported) tokens are NEVER looked up by symbol: anyone can
 *    deploy a token called "USDT", and a symbol lookup would give that scam
 *    token the real Tether logo. They resolve by contract address only, then
 *    fall back to an optional user-supplied logo URL, then to a letter badge.
 *
 * To point at a different logo repo, change the three constants below.
 */

import { CHAINS } from "./chains";

// jsDelivr serves GitHub content with caching + CORS; raw.githubusercontent is the fallback.
const SYMBOL_ICON_BASES = [
  "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color",
  "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color",
];
const TRUSTWALLET_BASE = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));

function bySymbol(symbol) {
  const s = (symbol || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s) return [];
  return SYMBOL_ICON_BASES.map((b) => `${b}/${s}.png`);
}

/** Native coin of a chain (ETH on Base is the ETH logo, not Base's). */
export function nativeLogoCandidates(chainKey) {
  const c = CHAINS[chainKey];
  return unique([
    ...c.iconSymbols.flatMap(bySymbol),
    `${TRUSTWALLET_BASE}/${c.twFolder}/info/logo.png`,
  ]);
}

/** The small network badge. */
export function chainLogoCandidates(chainKey) {
  return [`${TRUSTWALLET_BASE}/${CHAINS[chainKey].twFolder}/info/logo.png`];
}

/**
 * asset: chain, address (null = native), symbol, optional logo URL, verified flag.
 */
export function assetLogoCandidates(asset) {
  if (!asset.address) return nativeLogoCandidates(asset.chain);
  const c = CHAINS[asset.chain];
  return unique([
    asset.logo, // user-supplied URL for custom coins
    `${TRUSTWALLET_BASE}/${c.twFolder}/assets/${asset.address}/logo.png`,
    ...(asset.verified ? bySymbol(asset.symbol) : []),
  ]);
}

/**
 * Balances (RPC) and prices (CoinGecko) for a wallet across every network.
 * Both are best-effort: a failing chain or an unknown token simply leaves
 * that row without a value instead of breaking the whole portfolio.
 */

import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";
import { CHAINS, addressOnChain } from "./chains";
import { fetchTokenBalance } from "./tokens";

/**
 * @returns {Promise<Record<string,string>>} assetId → decimal balance string.
 *          Assets whose lookup failed are omitted (callers keep their last value).
 */
export async function fetchBalances({ entry, assets, getEvmProvider, getSolanaConnection }) {
  const out = {};
  await Promise.all(
    assets.map(async (asset) => {
      const owner = addressOnChain(entry, asset.chain);
      if (!owner) return;
      try {
        if (asset.native) {
          if (CHAINS[asset.chain].type === "solana") {
            const lamports = await getSolanaConnection().getBalance(new PublicKey(owner));
            out[asset.id] = ethers.formatUnits(BigInt(lamports), 9);
          } else {
            out[asset.id] = ethers.formatEther(await getEvmProvider(asset.chain).getBalance(owner));
          }
        } else {
          out[asset.id] = await fetchTokenBalance({ asset, owner, getEvmProvider, getSolanaConnection });
        }
      } catch {
        /* leave undefined */
      }
    })
  );
  return out;
}

/**
 * @returns {Promise<Record<string,{price:number, change:number|null}>>} assetId → price in `currency`
 */
export async function fetchPrices({ assets, currency }) {
  const out = {};
  const natives = assets.filter((a) => a.native);
  const tokens = assets.filter((a) => !a.native);

  const jobs = [];

  const ids = Array.from(new Set(natives.map((a) => CHAINS[a.chain].cgId)));
  if (ids.length) {
    jobs.push(
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=${currency}&include_24hr_change=true`)
        .then((r) => r.json())
        .then((d) => {
          for (const a of natives) {
            const row = d?.[CHAINS[a.chain].cgId];
            if (row && typeof row[currency] === "number") out[a.id] = { price: row[currency], change: row[`${currency}_24h_change`] ?? null };
          }
        })
        .catch(() => {})
    );
  }

  const byPlatform = {};
  for (const t of tokens) (byPlatform[CHAINS[t.chain].cgPlatform] ||= []).push(t);
  for (const [platform, list] of Object.entries(byPlatform)) {
    const addrs = list.map((t) => t.address).join(",");
    jobs.push(
      fetch(`https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${addrs}&vs_currencies=${currency}&include_24hr_change=true`)
        .then((r) => r.json())
        .then((d) => {
          const lower = {};
          for (const k of Object.keys(d || {})) lower[k.toLowerCase()] = d[k];
          for (const t of list) {
            const row = lower[t.address.toLowerCase()];
            if (row && typeof row[currency] === "number") out[t.id] = { price: row[currency], change: row[`${currency}_24h_change`] ?? null };
          }
        })
        .catch(() => {})
    );
  }

  await Promise.all(jobs);
  return out;
}

/**
 * Assets: native coins + custom/imported tokens (ERC-20 and SPL).
 *
 * An "asset" looks like
 *   { id, chain, address|null, symbol, name, decimals, native, custom, verified, logo? }
 * `id` is `${chain}:native` or `${chain}:${address}` and is the key used for
 * balances, prices and the hide-list.
 */

import "./polyfill";
import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import { CHAINS } from "./chains";

export const TOKEN_STORE_KEY = "pay3_tokens_v2";

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

/* ------------------------------------------------------------------ */
/*  Assets                                                             */
/* ------------------------------------------------------------------ */

export const assetId = (chain, address) => `${chain}:${address || "native"}`;

export function nativeAsset(chainKey) {
  const c = CHAINS[chainKey];
  return {
    id: assetId(chainKey, null),
    chain: chainKey,
    address: null,
    symbol: c.symbol,
    name: c.coinName,
    decimals: c.type === "solana" ? 9 : 18,
    native: true,
    custom: false,
    verified: true,
  };
}

/** Validate + normalise a contract/mint address for a chain (EVM → checksummed). */
export function normalizeTokenAddress(chainKey, input) {
  const v = (input || "").trim();
  if (!v) return null;
  try {
    if (CHAINS[chainKey].type === "solana") return new PublicKey(v).toBase58();
    return ethers.getAddress(v.toLowerCase());
  } catch {
    return null;
  }
}

/** Guess the network family from a pasted address. */
export function guessAddressFamily(input) {
  const v = (input || "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return "evm";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return "solana";
  return null;
}

/* ------------------------------------------------------------------ */
/*  Popular coins (one-tap add). Addresses are stored lowercase and    */
/*  checksummed at runtime; every one is re-verified on-chain (name,   */
/*  symbol, decimals) before it is saved.                               */
/* ------------------------------------------------------------------ */

const P = (chain, symbol, name, address, decimals) => ({ chain, symbol, name, address, decimals });

export const POPULAR_TOKENS = [
  P("ethereum", "USDT", "Tether USD", "0xdac17f958d2ee523a2206206994597c13d831ec7", 6),
  P("ethereum", "USDC", "USD Coin", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 6),
  P("ethereum", "DAI", "Dai Stablecoin", "0x6b175474e89094c44da98b954eedeac495271d0f", 18),
  P("ethereum", "WETH", "Wrapped Ether", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", 18),
  P("ethereum", "WBTC", "Wrapped BTC", "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", 8),
  P("ethereum", "LINK", "Chainlink", "0x514910771af9ca656af840dff83e8264ecf986ca", 18),
  P("ethereum", "UNI", "Uniswap", "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", 18),
  P("polygon", "USDC", "USD Coin", "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", 6),
  P("polygon", "USDT", "Tether USD", "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", 6),
  P("polygon", "DAI", "Dai Stablecoin", "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", 18),
  P("polygon", "WETH", "Wrapped Ether", "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", 18),
  P("polygon", "WPOL", "Wrapped POL", "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", 18),
  P("base", "USDC", "USD Coin", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 6),
  P("base", "DAI", "Dai Stablecoin", "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", 18),
  P("base", "WETH", "Wrapped Ether", "0x4200000000000000000000000000000000000006", 18),
  P("arbitrum", "USDC", "USD Coin", "0xaf88d065e77c8cc2239327c5edb3a432268e5831", 6),
  P("arbitrum", "USDT", "Tether USD", "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", 6),
  P("arbitrum", "ARB", "Arbitrum", "0x912ce59144191c1204e64559fe8253a0e49e6548", 18),
  P("arbitrum", "WETH", "Wrapped Ether", "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", 18),
  P("optimism", "USDC", "USD Coin", "0x0b2c639c533813f4aa9d7837caf62653d097ff85", 6),
  P("optimism", "USDT", "Tether USD", "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", 6),
  P("optimism", "OP", "Optimism", "0x4200000000000000000000000000000000000042", 18),
  P("solana", "USDC", "USD Coin", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 6),
  P("solana", "USDT", "Tether USD", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", 6),
  P("solana", "JUP", "Jupiter", "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", 6),
  P("solana", "BONK", "Bonk", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", 5),
].map((t) => {
  const address = normalizeTokenAddress(t.chain, t.address) || t.address;
  return { ...t, address, id: assetId(t.chain, address), native: false, custom: false, verified: true, popular: true };
});

/* ------------------------------------------------------------------ */
/*  Persistence                                                        */
/* ------------------------------------------------------------------ */

export function loadTokenStore() {
  try {
    const raw = window.localStorage.getItem(TOKEN_STORE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return { custom: Array.isArray(v?.custom) ? v.custom : [], hidden: Array.isArray(v?.hidden) ? v.hidden : [] };
  } catch {
    return { custom: [], hidden: [] };
  }
}

export function saveTokenStore(store) {
  try {
    window.localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota errors */
  }
}

/* ------------------------------------------------------------------ */
/*  On-chain metadata lookup (the heart of "import custom coin")        */
/* ------------------------------------------------------------------ */

const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function parseMetaplexMetadata(data) {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const dec = new TextDecoder();
  let o = 1 + 32 + 32; // key, update authority, mint
  const readString = () => {
    const len = dv.getUint32(o, true);
    o += 4;
    const s = dec.decode(data.subarray(o, o + len));
    o += len;
    return s.replace(/\0+$/g, "").trim();
  };
  const name = readString();
  const symbol = readString();
  const uri = readString();
  return { name, symbol, uri };
}

/**
 * Read name / symbol / decimals straight from the chain.
 * Resolves { name, symbol, decimals, partial } — `partial` means name or symbol
 * couldn't be read (some tokens return bytes32, Token-2022 keeps metadata
 * elsewhere) and the user should fill them in.
 * Rejects with a user-readable Error when the address isn't a token.
 */
export async function fetchTokenMeta({ chain, address, getEvmProvider, getSolanaConnection }) {
  const def = CHAINS[chain];
  if (def.type === "solana") {
    const connection = getSolanaConnection();
    const mint = new PublicKey(address);
    const info = await connection.getParsedAccountInfo(mint);
    const acct = info?.value;
    const parsed = acct?.data?.parsed;
    const owner = acct?.owner?.toBase58?.();
    if (!acct || parsed?.type !== "mint" || ![TOKEN_PROGRAM_ID.toBase58(), TOKEN_2022_PROGRAM_ID.toBase58()].includes(owner)) {
      throw new Error("That address isn't a Solana token mint.");
    }
    let name = "";
    let symbol = "";
    try {
      const [pda] = PublicKey.findProgramAddressSync([new TextEncoder().encode("metadata"), METADATA_PROGRAM.toBytes(), mint.toBytes()], METADATA_PROGRAM);
      const md = await connection.getAccountInfo(pda);
      if (md?.data) ({ name, symbol } = parseMetaplexMetadata(new Uint8Array(md.data)));
    } catch {
      /* no on-chain metadata account — user fills it in */
    }
    return { name, symbol, decimals: Number(parsed.info.decimals), partial: !name || !symbol };
  }

  const provider = getEvmProvider(chain);
  const code = await provider.getCode(address);
  if (!code || code === "0x") throw new Error(`There's no contract at this address on ${def.name}. Check the network and address.`);
  const c = new ethers.Contract(address, ERC20_ABI, provider);
  const [dec, sym, nam] = await Promise.allSettled([c.decimals(), c.symbol(), c.name()]);
  if (dec.status !== "fulfilled") throw new Error("That contract doesn't look like an ERC-20 token.");
  const symbol = sym.status === "fulfilled" ? String(sym.value) : "";
  const name = nam.status === "fulfilled" ? String(nam.value) : "";
  return { name, symbol, decimals: Number(dec.value), partial: !name || !symbol };
}

/* ------------------------------------------------------------------ */
/*  Balances                                                           */
/* ------------------------------------------------------------------ */

export async function fetchTokenBalance({ asset, owner, getEvmProvider, getSolanaConnection }) {
  if (CHAINS[asset.chain].type === "solana") {
    const res = await getSolanaConnection().getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: new PublicKey(asset.address) });
    let total = 0n;
    for (const a of res.value) total += BigInt(a.account.data.parsed.info.tokenAmount.amount);
    return ethers.formatUnits(total, asset.decimals);
  }
  const c = new ethers.Contract(asset.address, ERC20_ABI, getEvmProvider(asset.chain));
  return ethers.formatUnits(await c.balanceOf(owner), asset.decimals);
}

/* ------------------------------------------------------------------ */
/*  Sending                                                            */
/* ------------------------------------------------------------------ */

export const FALLBACK_TOKEN_GAS = 100000n;

export async function estimateEvmTokenGas({ provider, asset, from, to, amount }) {
  try {
    const c = new ethers.Contract(asset.address, ERC20_ABI, provider);
    const gas = await c.transfer.estimateGas(to, ethers.parseUnits(amount, asset.decimals), { from });
    return (gas * 12n) / 10n; // 20% headroom
  } catch {
    return FALLBACK_TOKEN_GAS;
  }
}

export async function sendEvmToken({ signer, asset, to, amount, overrides }) {
  const c = new ethers.Contract(asset.address, ERC20_ABI, signer);
  return c.transfer(to, ethers.parseUnits(amount, asset.decimals), overrides || {});
}

async function splProgramFor(connection, mint) {
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error("Token mint not found.");
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  if (info.owner.equals(TOKEN_PROGRAM_ID)) return TOKEN_PROGRAM_ID;
  throw new Error("Unsupported token program.");
}

/** True when the recipient has no token account yet (sender pays ~0.002 SOL rent to create it). */
export async function solRecipientNeedsAccount({ connection, asset, to }) {
  try {
    const mint = new PublicKey(asset.address);
    const program = await splProgramFor(connection, mint);
    const ata = getAssociatedTokenAddressSync(mint, new PublicKey(to), true, program);
    return !(await connection.getAccountInfo(ata));
  } catch {
    return false;
  }
}

export async function sendSolanaToken({ connection, keypair, asset, to, amount }) {
  const mint = new PublicKey(asset.address);
  const owner = keypair.publicKey;
  const toPk = new PublicKey(to);
  const program = await splProgramFor(connection, mint);
  const fromAta = getAssociatedTokenAddressSync(mint, owner, false, program);
  const toAta = getAssociatedTokenAddressSync(mint, toPk, true, program);

  const ixs = [];
  if (!(await connection.getAccountInfo(toAta))) {
    ixs.push(createAssociatedTokenAccountInstruction(owner, toAta, toPk, mint, program));
  }
  ixs.push(createTransferCheckedInstruction(fromAta, mint, toAta, owner, ethers.parseUnits(amount, asset.decimals), asset.decimals, [], program));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: owner, recentBlockhash: blockhash }).add(...ixs);
  tx.sign(keypair);
  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

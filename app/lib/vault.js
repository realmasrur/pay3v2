/**
 * Multi-wallet vault.
 *
 * Storage layout (localStorage, key `pay3_vault_v2`):
 *   {
 *     version: 2,
 *     activeId: "<wallet id>",
 *     wallets: [{
 *       id, name, kind: "phrase" | "evmkey" | "solkey",
 *       index,                      // account index for phrase wallets (0 = first)
 *       evmAddress | null,          // public
 *       solAddress | null,          // public
 *       keystore,                   // password-encrypted ethers V3 JSON string
 *       avatar | null,              // optional photo (data URL)
 *       createdAt
 *     }]
 *   }
 *
 * Only public data (addresses, names) is readable without the password; every
 * secret sits inside its own V3 keystore. All wallets share one password.
 *
 * Wallet kinds
 *   phrase  – BIP-39 phrase → EVM (m/44'/60'/0'/0/i) + Solana (m/44'/501'/i'/0')
 *   evmkey  – raw secp256k1 private key → EVM chains only
 *   solkey  – raw ed25519 key → Solana only. The 32-byte seed is wrapped in a
 *             V3 keystore as if it were a secp256k1 key (a valid scalar with
 *             overwhelming probability) purely so the same vetted encryption
 *             is used for every wallet. The synthetic EVM address that
 *             produces is never shown or used.
 */

import "./polyfill";
import { ethers } from "ethers";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import { EVM_PATH, SOLANA_PATH } from "./chains";

export const VAULT_KEY = "pay3_vault_v2";
export const LEGACY_KEYSTORE_KEY = "pay3_encrypted_keystore_v1";
const LEGACY_NAME_KEY = "pay3_display_name_v1";
const LEGACY_AVATAR_KEY = "pay3_avatar_v1";

export const WALLET_KINDS = {
  phrase: { label: "Recovery phrase", short: "Phrase" },
  evmkey: { label: "Private key (EVM)", short: "EVM key" },
  solkey: { label: "Private key (Solana)", short: "Solana key" },
};

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

export function newId() {
  const rand = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `w_${rand.slice(0, 12)}`;
}

export function loadVault() {
  try {
    const raw = window.localStorage.getItem(VAULT_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v && Array.isArray(v.wallets) && v.wallets.length) {
        if (!v.wallets.some((w) => w.id === v.activeId)) v.activeId = v.wallets[0].id;
        return v;
      }
    }
    return migrateLegacy();
  } catch {
    return null;
  }
}

export function saveVault(vault) {
  try {
    if (!vault || !vault.wallets.length) window.localStorage.removeItem(VAULT_KEY);
    else window.localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  } catch {
    /* storage unavailable — callers surface their own errors */
  }
}

export function clearAllWalletData() {
  try {
    window.localStorage.removeItem(VAULT_KEY);
    window.localStorage.removeItem(LEGACY_KEYSTORE_KEY);
    window.localStorage.removeItem(LEGACY_NAME_KEY);
    window.localStorage.removeItem(LEGACY_AVATAR_KEY);
  } catch {
    /* ignore */
  }
}

/** Pre-v2 installs stored ONE keystore; wrap it so nobody has to re-import. */
function migrateLegacy() {
  const json = window.localStorage.getItem(LEGACY_KEYSTORE_KEY);
  if (!json) return null;
  const parsed = JSON.parse(json);
  const hasMnemonic = !!parsed?.["x-ethers"]?.mnemonicCiphertext;
  const vault = {
    version: 2,
    activeId: "",
    wallets: [
      {
        id: newId(),
        name: window.localStorage.getItem(LEGACY_NAME_KEY) || "Wallet 1",
        kind: hasMnemonic ? "phrase" : "evmkey",
        index: 0,
        evmAddress: ethers.getAddress(`0x${parsed.address.replace(/^0x/, "")}`),
        solAddress: null, // filled in the first time the wallet is unlocked
        keystore: json,
        avatar: window.localStorage.getItem(LEGACY_AVATAR_KEY) || null,
        createdAt: Date.now(),
      },
    ],
  };
  vault.activeId = vault.wallets[0].id;
  saveVault(vault);
  return vault;
}

/* ------------------------------------------------------------------ */
/*  Pure vault operations (return a new vault)                         */
/* ------------------------------------------------------------------ */

export function nextWalletName(vault) {
  const used = (vault?.wallets || []).map((w) => /^Wallet (\d+)$/.exec(w.name)?.[1]).filter(Boolean).map(Number);
  return `Wallet ${used.length ? Math.max(...used) + 1 : (vault?.wallets.length || 0) + 1}`;
}

export function withWallet(vault, entry, makeActive = true) {
  const base = vault || { version: 2, activeId: entry.id, wallets: [] };
  return { ...base, activeId: makeActive ? entry.id : base.activeId, wallets: [...base.wallets, entry] };
}

export function updateWallet(vault, id, patch) {
  return { ...vault, wallets: vault.wallets.map((w) => (w.id === id ? { ...w, ...patch } : w)) };
}

export function withoutWallet(vault, id) {
  const wallets = vault.wallets.filter((w) => w.id !== id);
  const activeId = vault.activeId === id ? wallets[0]?.id || "" : vault.activeId;
  return { ...vault, wallets, activeId };
}

export function findDuplicate(vault, { evmAddress, solAddress }) {
  return (vault?.wallets || []).find(
    (w) => (evmAddress && w.evmAddress && w.evmAddress.toLowerCase() === evmAddress.toLowerCase()) || (solAddress && w.solAddress === solAddress)
  );
}

/* ------------------------------------------------------------------ */
/*  Key material                                                       */
/* ------------------------------------------------------------------ */

export function normalizePhrase(input) {
  return (input || "").trim().toLowerCase().split(/\s+/).join(" ");
}

export function deriveFromMnemonic(phrase, index = 0) {
  const evm = ethers.HDNodeWallet.fromPhrase(phrase, undefined, EVM_PATH(index));
  const seed = bip39.mnemonicToSeedSync(phrase);
  const { key } = derivePath(SOLANA_PATH(index), seed.toString("hex"));
  const solana = Keypair.fromSeed(key);
  return { evm, solana };
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Decode(str) {
  let n = 0n;
  for (const c of str) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("Invalid base58 character");
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const body = n === 0n ? [] : hex.match(/../g).map((h) => parseInt(h, 16));
  let zeros = 0;
  for (const c of str) {
    if (c === "1") zeros++;
    else break;
  }
  return Uint8Array.from([...new Array(zeros).fill(0), ...body]);
}

/** Accepts base58 (Phantom/Solflare export), a JSON byte array (solana-keygen) or hex. */
export function parseSolanaSecret(input) {
  const s = (input || "").trim();
  let bytes;
  if (s.startsWith("[")) {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr) || arr.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error("Invalid key array");
    bytes = Uint8Array.from(arr);
  } else if (/^(0x)?[0-9a-fA-F]{64}$|^(0x)?[0-9a-fA-F]{128}$/.test(s)) {
    bytes = ethers.getBytes(s.startsWith("0x") ? s : `0x${s}`);
  } else {
    bytes = base58Decode(s);
  }
  if (bytes.length === 64) return Keypair.fromSecretKey(bytes); // validates the public half matches
  if (bytes.length === 32) return Keypair.fromSeed(bytes);
  throw new Error("Solana keys must be 32 or 64 bytes");
}

/**
 * Build a wallet entry from user input and encrypt it.
 * Returns { entry, opened } where `opened` is the in-memory key material.
 */
export async function buildEntry({ kind, secret, password, name, index = 0 }) {
  let evm = null;
  let solana = null;
  let phrase = null;
  let toEncrypt;

  if (kind === "phrase") {
    phrase = normalizePhrase(secret);
    if (!ethers.Mnemonic.isValidMnemonic(phrase)) throw new Error("That recovery phrase isn't valid. Check the words and their order.");
    ({ evm, solana } = deriveFromMnemonic(phrase, index));
    toEncrypt = evm;
  } else if (kind === "evmkey") {
    const pk = (secret || "").trim();
    evm = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`);
    toEncrypt = evm;
  } else if (kind === "solkey") {
    solana = parseSolanaSecret(secret);
    toEncrypt = new ethers.Wallet(ethers.hexlify(solana.secretKey.slice(0, 32)));
  } else {
    throw new Error("Unknown wallet type");
  }

  const keystore = await toEncrypt.encrypt(password);
  const entry = {
    id: newId(),
    name: (name || "").trim().slice(0, 40),
    kind,
    index: kind === "phrase" ? index : 0,
    evmAddress: evm ? evm.address : null,
    solAddress: solana ? solana.publicKey.toBase58() : null,
    keystore,
    avatar: null,
    createdAt: Date.now(),
  };
  return { entry, opened: { evm, solana, phrase } };
}

/** Decrypt an entry with the password → live signers. Throws on a wrong password. */
export async function openEntry(entry, password) {
  const w = await ethers.Wallet.fromEncryptedJson(entry.keystore, password);
  if (entry.kind === "phrase") {
    const phrase = w.mnemonic?.phrase;
    if (!phrase) throw new Error("Recovery phrase missing from keystore");
    const { evm, solana } = deriveFromMnemonic(phrase, entry.index || 0);
    return { evm, solana, phrase };
  }
  if (entry.kind === "evmkey") return { evm: new ethers.Wallet(w.privateKey), solana: null, phrase: null };
  if (entry.kind === "solkey") return { evm: null, solana: Keypair.fromSeed(ethers.getBytes(w.privateKey)), phrase: null };
  throw new Error("Unknown wallet type");
}

/** Secret to show on the backup screen. */
export function secretForBackup(entry, opened) {
  if (entry.kind === "phrase") return { label: "Recovery phrase", text: opened.phrase, words: opened.phrase.split(" ") };
  if (entry.kind === "evmkey") return { label: "Private key", text: opened.evm.privateKey, words: null };
  return { label: "Private key (base58)", text: bs58Encode(opened.solana.secretKey), words: null };
}

function bs58Encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) out = `1${out}`;
    else break;
  }
  return out;
}

/** Lowest account index of this phrase that isn't in the vault yet (for "Add another account"). */
export function nextFreeIndex(vault, phrase) {
  for (let i = 0; i < 50; i++) {
    const { evm } = deriveFromMnemonic(phrase, i);
    if (!findDuplicate(vault, { evmAddress: evm.address })) return i;
  }
  throw new Error("Too many accounts from this phrase");
}

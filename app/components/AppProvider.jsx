"use client";

/**
 * AppProvider — all wallet state and logic in one place; screens read it with useApp().
 *
 * Session model
 *  - The vault (public data + per-wallet encrypted keystores) lives in localStorage.
 *  - On unlock the ACTIVE wallet is decrypted. Other wallets are decrypted lazily
 *    the first time you switch to them, using the unlock password, which is kept
 *    only in memory (a ref) until you lock the app.
 *  - Decrypted keys are held in React state for the session — same exposure the
 *    single-wallet version had.
 */

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { Connection } from "@solana/web3.js";
import { CHAINS, CHAIN_ORDER, rpcUrl, chainsForWallet, addressOnChain, chainKeyFromCaip, ALCHEMY_API_KEY, WALLETCONNECT_PROJECT_ID, WC_METHODS, WC_EVENTS } from "../lib/chains";
import { loadVault, saveVault, clearAllWalletData, buildEntry, openEntry, findDuplicate, nextWalletName, withWallet, updateWallet, withoutWallet } from "../lib/vault";
import { nativeAsset, assetId, loadTokenStore, saveTokenStore } from "../lib/tokens";
import { fetchBalances, fetchPrices } from "../lib/portfolio";
import { fetchEvmActivity, fetchSolanaActivity } from "../lib/activity";
import { fileToAvatar } from "../lib/image";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const PREFS_KEY = "pay3_prefs_v1";
const WC_WALLETS_KEY = "pay3_wc_wallets_v1";
const DEFAULT_PREFS = { currency: "usd", hideBalance: false, hideSmall: false };
const BALANCE_TTL = 45000;
const ACTIVITY_TTL = 60000;

function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Natives for every chain this wallet can use + the user's imported tokens on those chains. */
export function assetsForEntry(entry, customTokens) {
  const chains = chainsForWallet(entry);
  return [...chains.map(nativeAsset), ...customTokens.filter((t) => chains.includes(t.chain))];
}

export function AppProvider({ children }) {
  /* ---------------- providers ---------------- */
  const evmProviderCacheRef = useRef({});
  const solanaConnectionRef = useRef(null);
  const getEvmProvider = useCallback((chainKey) => {
    if (!evmProviderCacheRef.current[chainKey]) {
      const def = CHAINS[chainKey];
      evmProviderCacheRef.current[chainKey] = new ethers.JsonRpcProvider(rpcUrl(def), def.chainId, { staticNetwork: ethers.Network.from(def.chainId) });
    }
    return evmProviderCacheRef.current[chainKey];
  }, []);
  const getSolanaConnection = useCallback(() => {
    if (!solanaConnectionRef.current) solanaConnectionRef.current = new Connection(rpcUrl(CHAINS.solana), "confirmed");
    return solanaConnectionRef.current;
  }, []);

  /* ---------------- core state ---------------- */
  const [stage, setStage] = useState("loading"); // loading | welcome | unlock | app
  const [vault, setVaultState] = useState(null);
  const vaultRef = useRef(null);
  const [opened, setOpened] = useState({}); // walletId → { evm, solana, phrase }
  const openedRef = useRef({});
  const pwRef = useRef("");
  const balancesAtRef = useRef({}); // walletId → last request time (also de-dupes in-flight calls)
  const [switching, setSwitching] = useState(false);

  const [prefs, setPrefsState] = useState(DEFAULT_PREFS);
  const [tokenStore, setTokenStoreState] = useState({ custom: [], hidden: [] });
  const tokenStoreRef = useRef(tokenStore);
  const [networkFilter, setNetworkFilter] = useState("all");

  const [stack, setStack] = useState([{ name: "home" }]);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);

  const [balances, setBalances] = useState({}); // walletId → { assetId → string }
  const [balancesAt, setBalancesAt] = useState({});
  const [prices, setPrices] = useState({});
  const [pricesReady, setPricesReady] = useState(false);

  const setVault = useCallback((v) => {
    vaultRef.current = v;
    setVaultState(v);
    saveVault(v);
  }, []);
  const setOpenedBoth = useCallback((updater) => {
    setOpened((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      openedRef.current = next;
      return next;
    });
  }, []);
  const setTokenStore = useCallback((store) => {
    tokenStoreRef.current = store;
    setTokenStoreState(store);
    saveTokenStore(store);
  }, []);
  const setPrefs = useCallback((patch) => {
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      writeJSON(PREFS_KEY, next);
      return next;
    });
  }, []);

  /* ---------------- toast / clipboard ---------------- */
  const toastTimer = useRef(null);
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  const copyText = useCallback(
    async (text, label = "Copied to clipboard") => {
      try {
        await navigator.clipboard.writeText(text);
        showToast("success", label);
      } catch {
        showToast("error", "Couldn't copy");
      }
    },
    [showToast]
  );

  /* ---------------- navigation ---------------- */
  const route = stack[stack.length - 1];
  const nav = useCallback((name, params = {}) => setStack((s) => [...s, { name, params }]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ name: "home" }])), []);
  const goTab = useCallback((name) => setStack([{ name }]), []);
  const openSheet = useCallback((type, params = {}) => setSheet({ type, params }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  /* ---------------- boot ---------------- */
  useEffect(() => {
    setPrefsState({ ...DEFAULT_PREFS, ...readJSON(PREFS_KEY, {}) });
    const store = loadTokenStore();
    tokenStoreRef.current = store;
    setTokenStoreState(store);
    const v = loadVault();
    vaultRef.current = v;
    setVaultState(v);
    setStage(v ? "unlock" : "welcome");
  }, []);

  /* ---------------- derived: active wallet ---------------- */
  const wallets = vault?.wallets || [];
  const activeEntry = wallets.find((w) => w.id === vault?.activeId) || null;
  const activeKeys = activeEntry ? opened[activeEntry.id] || null : null;
  const walletChains = useMemo(() => chainsForWallet(activeEntry), [activeEntry]);

  // If the filter points at a chain this wallet can't use, fall back to "all".
  useEffect(() => {
    if (networkFilter !== "all" && activeEntry && !walletChains.includes(networkFilter)) setNetworkFilter("all");
  }, [networkFilter, activeEntry, walletChains]);

  /* ---------------- wallet lifecycle ---------------- */
  const unlock = useCallback(
    async (password) => {
      const v = vaultRef.current;
      const entry = v?.wallets.find((w) => w.id === v.activeId) || v?.wallets[0];
      if (!entry) throw new Error("No wallet found");
      const keys = await openEntry(entry, password); // throws on wrong password
      pwRef.current = password;
      let next = v;
      if (!entry.solAddress && keys.solana) next = updateWallet(next, entry.id, { solAddress: keys.solana.publicKey.toBase58() });
      if (next.activeId !== entry.id) next = { ...next, activeId: entry.id };
      if (next !== v) setVault(next);
      setOpenedBoth({ [entry.id]: keys });
      setStack([{ name: "home" }]);
      setStage("app");
    },
    [setVault, setOpenedBoth]
  );

  const lock = useCallback(() => {
    pwRef.current = "";
    setOpenedBoth({});
    setBalances({});
    setBalancesAt({});
    balancesAtRef.current = {};
    setSheet(null);
    setStack([{ name: "home" }]);
    setStage("unlock");
  }, [setOpenedBoth]);

  const resetAll = useCallback(() => {
    pwRef.current = "";
    clearAllWalletData();
    setOpenedBoth({});
    setBalances({});
    setBalancesAt({});
    balancesAtRef.current = {};
    setVault(null);
    setSheet(null);
    setStack([{ name: "home" }]);
    setStage("welcome");
    showToast("success", "All wallets removed from this device");
  }, [setOpenedBoth, setVault, showToast]);

  /** Create or import a wallet. `password` is only needed for the very first wallet. */
  const addWallet = useCallback(
    async ({ kind, secret, name, index = 0, password }) => {
      const pw = pwRef.current || password;
      if (!pw) throw new Error("Enter a password first.");
      const current = vaultRef.current;
      const { entry, opened: keys } = await buildEntry({ kind, secret, password: pw, name, index });
      const dup = findDuplicate(current, entry);
      if (dup) throw new Error(`This wallet is already added as “${dup.name}”.`);
      entry.name = entry.name || nextWalletName(current);
      pwRef.current = pw;
      setVault(withWallet(current, entry, true));
      setOpenedBoth((prev) => ({ ...prev, [entry.id]: keys }));
      if (stage !== "app") {
        setStack([{ name: "home" }]);
        setStage("app");
      } else {
        setStack([{ name: "home" }]);
      }
      showToast("success", current ? `${entry.name} added` : "Wallet ready");
      return entry;
    },
    [setVault, setOpenedBoth, showToast, stage]
  );

  const ensureOpen = useCallback(
    async (id) => {
      if (openedRef.current[id]) return openedRef.current[id];
      const entry = vaultRef.current?.wallets.find((w) => w.id === id);
      if (!entry || !pwRef.current) throw new Error("Wallet is locked");
      const keys = await openEntry(entry, pwRef.current);
      setOpenedBoth((prev) => ({ ...prev, [id]: keys }));
      return keys;
    },
    [setOpenedBoth]
  );

  const switchWallet = useCallback(
    async (id) => {
      const v = vaultRef.current;
      if (!v || v.activeId === id) return;
      setSwitching(true);
      try {
        const keys = await ensureOpen(id);
        let next = { ...v, activeId: id };
        const entry = v.wallets.find((w) => w.id === id);
        if (!entry.solAddress && keys.solana) next = updateWallet(next, id, { solAddress: keys.solana.publicKey.toBase58() });
        setVault(next);
        setStack([{ name: "home" }]);
        setSheet(null);
      } catch {
        showToast("error", "Couldn't unlock that wallet");
      }
      setSwitching(false);
    },
    [ensureOpen, setVault, showToast]
  );

  const renameWallet = useCallback(
    (id, name) => {
      const trimmed = (name || "").trim().slice(0, 40);
      if (!trimmed) return;
      setVault(updateWallet(vaultRef.current, id, { name: trimmed }));
    },
    [setVault]
  );

  const setWalletAvatar = useCallback(
    async (id, file) => {
      try {
        const dataUrl = file ? await fileToAvatar(file) : null;
        setVault(updateWallet(vaultRef.current, id, { avatar: dataUrl }));
        showToast("success", dataUrl ? "Photo updated" : "Photo removed");
      } catch (e) {
        showToast("error", e?.message || "Couldn't use that image");
      }
    },
    [setVault, showToast]
  );

  const removeWallet = useCallback(
    (id) => {
      const v = vaultRef.current;
      if (!v) return;
      if (v.wallets.length <= 1) {
        resetAll();
        return;
      }
      const next = withoutWallet(v, id);
      setVault(next);
      setOpenedBoth((prev) => {
        const { [id]: _gone, ...rest } = prev;
        return rest;
      });
      setBalances((b) => {
        const { [id]: _g, ...rest } = b;
        return rest;
      });
      // make sure the new active wallet is decrypted
      ensureOpen(next.activeId).catch(() => showToast("error", "Couldn't unlock the next wallet"));
      setStack([{ name: "home" }]);
      showToast("success", "Wallet removed from this device");
    },
    [resetAll, setVault, setOpenedBoth, ensureOpen, showToast]
  );

  /** Re-decrypt with a typed password (used by Backup) — never trusts the session. */
  const decryptForBackup = useCallback(async (id, password) => {
    const entry = vaultRef.current?.wallets.find((w) => w.id === id);
    if (!entry) throw new Error("Wallet not found");
    return { entry, keys: await openEntry(entry, password) };
  }, []);

  /* ---------------- tokens ---------------- */
  const addToken = useCallback(
    (token) => {
      const store = tokenStoreRef.current;
      const id = assetId(token.chain, token.address);
      const full = {
        id,
        chain: token.chain,
        address: token.address,
        symbol: token.symbol,
        name: token.name || token.symbol,
        decimals: token.decimals,
        logo: token.logo || "",
        verified: !!token.verified,
        native: false,
        custom: true,
      };
      setTokenStore({ custom: [...store.custom.filter((t) => t.id !== id), full], hidden: store.hidden.filter((h) => h !== id) });
      // fetch the new token's balance right away
      const v = vaultRef.current;
      const entry = v?.wallets.find((w) => w.id === v.activeId);
      if (entry) {
        fetchBalances({ entry, assets: [full], getEvmProvider, getSolanaConnection }).then((res) =>
          setBalances((b) => ({ ...b, [entry.id]: { ...(b[entry.id] || {}), ...res } }))
        );
      }
      return full;
    },
    [setTokenStore, getEvmProvider, getSolanaConnection]
  );

  const removeToken = useCallback(
    (id) => {
      const s = tokenStoreRef.current;
      setTokenStore({ custom: s.custom.filter((t) => t.id !== id), hidden: s.hidden.filter((h) => h !== id) });
    },
    [setTokenStore]
  );

  const toggleHidden = useCallback(
    (id) => {
      const s = tokenStoreRef.current;
      setTokenStore({ ...s, hidden: s.hidden.includes(id) ? s.hidden.filter((h) => h !== id) : [...s.hidden, id] });
    },
    [setTokenStore]
  );

  /* ---------------- portfolio refresh ---------------- */
  const refreshBalances = useCallback(
    async (walletId, { force = false } = {}) => {
      const entry = vaultRef.current?.wallets.find((w) => w.id === walletId);
      if (!entry) return;
      if (!force && Date.now() - (balancesAtRef.current[walletId] || 0) < BALANCE_TTL) return;
      balancesAtRef.current[walletId] = Date.now();
      const res = await fetchBalances({ entry, assets: assetsForEntry(entry, tokenStoreRef.current.custom), getEvmProvider, getSolanaConnection });
      setBalances((b) => ({ ...b, [walletId]: { ...(b[walletId] || {}), ...res } }));
      setBalancesAt((a) => ({ ...a, [walletId]: Date.now() }));
    },
    [getEvmProvider, getSolanaConnection]
  );

  const activeId = vault?.activeId;
  useEffect(() => {
    if (stage !== "app" || !activeId) return;
    refreshBalances(activeId, { force: true });
    const t = window.setInterval(() => refreshBalances(activeId, { force: true }), 30000);
    return () => window.clearInterval(t);
  }, [stage, activeId, refreshBalances]);

  const customKey = tokenStore.custom.map((t) => t.id).join(",");
  const walletCount = wallets.length;
  const priceAssets = useMemo(() => {
    const natives = CHAIN_ORDER.map(nativeAsset);
    return [...natives, ...tokenStore.custom];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customKey]);

  useEffect(() => {
    if (stage !== "app") return;
    let cancelled = false;
    const run = () =>
      fetchPrices({ assets: priceAssets, currency: prefs.currency }).then((res) => {
        if (cancelled) return;
        setPrices(res);
        setPricesReady(true);
      });
    run();
    const t = window.setInterval(run, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [stage, priceAssets, prefs.currency]);

  /* Make sure every wallet's totals are fresh when the switcher is open. */
  useEffect(() => {
    if (sheet?.type !== "wallets") return;
    (vaultRef.current?.wallets || []).forEach((w) => refreshBalances(w.id));
  }, [sheet, refreshBalances, walletCount]);

  /* ---------------- derived: asset rows ---------------- */
  const hidden = tokenStore.hidden;
  const myBalances = (activeEntry && balances[activeEntry.id]) || {};
  const balancesLoaded = !!(activeEntry && balancesAt[activeEntry.id]);

  const allAssets = useMemo(() => {
    if (!activeEntry) return [];
    return assetsForEntry(activeEntry, tokenStore.custom).map((a) => {
      const balance = parseFloat(myBalances[a.id] ?? "0") || 0;
      const p = prices[a.id];
      const value = p ? balance * p.price : null;
      return { ...a, balance, rawBalance: myBalances[a.id] ?? null, price: p?.price ?? null, change: p?.change ?? null, value, hidden: hidden.includes(a.id) };
    });
  }, [activeEntry, tokenStore.custom, myBalances, prices, hidden]);

  const inFilter = useCallback((a) => networkFilter === "all" || a.chain === networkFilter, [networkFilter]);

  const visibleAssets = useMemo(() => {
    const rows = allAssets.filter((a) => {
      if (a.hidden || !inFilter(a)) return false;
      if (prefs.hideSmall && a.value != null && a.value < 1 && !a.native) return false;
      if (a.balance > 0) return true;
      if (a.custom) return true;
      return networkFilter !== "all" && a.native; // show the native coin when browsing one network
    });
    return rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || b.balance - a.balance);
  }, [allAssets, inFilter, prefs.hideSmall, networkFilter]);

  const total = useMemo(() => allAssets.filter((a) => !a.hidden && inFilter(a)).reduce((n, a) => n + (a.value || 0), 0), [allAssets, inFilter]);

  const walletTotals = useMemo(() => {
    const out = {};
    for (const w of wallets) {
      const b = balances[w.id];
      out[w.id] = b ? assetsForEntry(w, tokenStore.custom).filter((a) => !hidden.includes(a.id)).reduce((n, a) => n + (parseFloat(b[a.id] ?? "0") || 0) * (prices[a.id]?.price || 0), 0) : null;
    }
    return out;
  }, [wallets, balances, prices, tokenStore.custom, hidden]);

  /* ---------------- signers & activity ---------------- */
  const getSigner = useCallback(
    (chainKey) => {
      if (!activeKeys) return null;
      if (CHAINS[chainKey].type === "solana") return activeKeys.solana;
      return activeKeys.evm ? activeKeys.evm.connect(getEvmProvider(chainKey)) : null;
    },
    [activeKeys, getEvmProvider]
  );

  const activityCache = useRef({});
  const symbolForMint = useCallback((mint) => tokenStoreRef.current.custom.find((t) => t.chain === "solana" && t.address === mint)?.symbol, []);
  const getActivity = useCallback(
    async (chainKey, { force = false } = {}) => {
      const entry = vaultRef.current?.wallets.find((w) => w.id === vaultRef.current.activeId);
      const address = addressOnChain(entry, chainKey);
      if (!address) return [];
      const key = `${entry.id}:${chainKey}`;
      const hit = activityCache.current[key];
      if (!force && hit && Date.now() - hit.at < ACTIVITY_TTL) return hit.rows;
      let rows = hit?.rows || [];
      try {
        rows =
          CHAINS[chainKey].type === "solana"
            ? await fetchSolanaActivity({ connection: getSolanaConnection(), address, symbolForMint })
            : await fetchEvmActivity({ provider: getEvmProvider(chainKey), chain: chainKey, address });
        activityCache.current[key] = { rows, at: Date.now() };
      } catch {
        /* keep the last good list */
      }
      return rows;
    },
    [getEvmProvider, getSolanaConnection, symbolForMint]
  );

  /* ---------------- WalletConnect ---------------- */
  const [walletKit, setWalletKit] = useState(null);
  const wcUtilsRef = useRef({});
  const [pendingProposal, setPendingProposal] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  useEffect(() => {
    if (stage !== "app") return;
    let cancelled = false;
    (async () => {
      try {
        const [{ Core }, { WalletKit }, utils] = await Promise.all([import("@walletconnect/core"), import("@reown/walletkit"), import("@walletconnect/utils")]);
        if (cancelled) return;
        wcUtilsRef.current = { buildApprovedNamespaces: utils.buildApprovedNamespaces, getSdkError: utils.getSdkError };
        const core = new Core({ projectId: WALLETCONNECT_PROJECT_ID });
        const wk = await WalletKit.init({
          core,
          metadata: { name: "Pay3", description: "Pay3 self-custody multi-chain wallet", url: "https://pay3.space", icons: ["https://pay3.space/logo.png"] },
        });
        if (cancelled) return;
        wk.on("session_proposal", (p) => setPendingProposal(p));
        wk.on("session_request", (e) => setPendingRequest(e));
        wk.on("session_delete", () => setSessionsVersion((v) => v + 1));
        setWalletKit(wk);
        setSessionsVersion((v) => v + 1);
      } catch {
        /* WalletConnect failed to start (e.g. offline) — the rest of the app still works. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  const sessionWallet = useCallback((topic) => readJSON(WC_WALLETS_KEY, {})[topic] || null, []);

  const pairUri = useCallback(
    async (uri) => {
      const trimmed = (uri || "").trim();
      if (!trimmed.toLowerCase().startsWith("wc:")) return showToast("error", "That doesn't look like a WalletConnect link");
      if (!walletKit) return showToast("error", "WalletConnect is still starting up — try again in a moment");
      try {
        await walletKit.pair({ uri: trimmed });
      } catch {
        showToast("error", "Couldn't start that connection — the link may have expired");
      }
    },
    [walletKit, showToast]
  );

  const approveProposal = useCallback(async () => {
    if (!pendingProposal || !walletKit) return;
    const proposal = pendingProposal;
    const evmAddress = activeEntry?.evmAddress;
    try {
      if (!evmAddress) throw new Error("no-evm");
      const evmKeys = CHAIN_ORDER.filter((k) => CHAINS[k].type === "evm");
      const approved = wcUtilsRef.current.buildApprovedNamespaces({
        proposal: proposal.params,
        supportedNamespaces: {
          eip155: {
            chains: evmKeys.map((k) => `eip155:${CHAINS[k].chainId}`),
            methods: WC_METHODS,
            events: WC_EVENTS,
            accounts: evmKeys.map((k) => `eip155:${CHAINS[k].chainId}:${evmAddress}`),
          },
        },
      });
      const session = await walletKit.approveSession({ id: proposal.id, namespaces: approved });
      if (session?.topic) writeJSON(WC_WALLETS_KEY, { ...readJSON(WC_WALLETS_KEY, {}), [session.topic]: activeEntry.id });
      setSessionsVersion((v) => v + 1);
      showToast("success", "Connected");
    } catch (e) {
      try {
        await walletKit.rejectSession({ id: proposal.id, reason: wcUtilsRef.current.getSdkError("UNSUPPORTED_CHAINS") });
      } catch {
        /* ignore */
      }
      showToast("error", e?.message === "no-evm" ? "This wallet has no EVM address — switch to another wallet" : "Couldn't connect — this app may need a network Pay3 doesn't support");
    }
    setPendingProposal(null);
  }, [pendingProposal, walletKit, activeEntry, showToast]);

  const rejectProposal = useCallback(async () => {
    if (!pendingProposal || !walletKit) return;
    try {
      await walletKit.rejectSession({ id: pendingProposal.id, reason: wcUtilsRef.current.getSdkError("USER_REJECTED") });
    } catch {
      /* ignore */
    }
    setPendingProposal(null);
  }, [pendingProposal, walletKit]);

  const approveRequest = useCallback(async () => {
    if (!pendingRequest || !walletKit) return;
    const { id, topic, params } = pendingRequest;
    const { request, chainId } = params;
    const respondError = async (code, message) => {
      try {
        await walletKit.respondSessionRequest({ topic, response: { id, jsonrpc: "2.0", error: { code, message } } });
      } catch {
        /* ignore */
      }
    };
    try {
      // Sign with the wallet the session was approved for — not whichever is active now.
      const walletId = sessionWallet(topic) || vaultRef.current?.activeId;
      const keys = await ensureOpen(walletId);
      if (!keys?.evm) throw new Error("This wallet can't sign EVM requests");
      const chainKey = chainKeyFromCaip(chainId) || "ethereum";
      const signer = keys.evm.connect(getEvmProvider(chainKey));
      let result;
      switch (request.method) {
        case "personal_sign": {
          const [msgHex] = request.params;
          result = await signer.signMessage(ethers.getBytes(msgHex));
          break;
        }
        case "eth_sendTransaction": {
          const p = request.params[0];
          const tx = await signer.sendTransaction({ to: p.to, value: p.value ? BigInt(p.value) : undefined, data: p.data, gasLimit: p.gas ? BigInt(p.gas) : undefined });
          result = tx.hash;
          break;
        }
        case "eth_signTransaction": {
          const p = request.params[0];
          result = await signer.signTransaction({ to: p.to, value: p.value ? BigInt(p.value) : undefined, data: p.data });
          break;
        }
        case "eth_signTypedData":
        case "eth_signTypedData_v4": {
          const [, raw] = request.params;
          const typed = typeof raw === "string" ? JSON.parse(raw) : raw;
          const types = { ...typed.types };
          delete types.EIP712Domain;
          result = await signer.signTypedData(typed.domain, types, typed.message);
          break;
        }
        default:
          throw new Error("Unsupported method");
      }
      await walletKit.respondSessionRequest({ topic, response: { id, jsonrpc: "2.0", result } });
      showToast("success", "Approved");
    } catch (e) {
      await respondError(5000, e?.shortMessage || e?.message || "Request failed");
      showToast("error", "Request failed");
    }
    setPendingRequest(null);
  }, [pendingRequest, walletKit, sessionWallet, ensureOpen, getEvmProvider, showToast]);

  const rejectRequest = useCallback(async () => {
    if (!pendingRequest || !walletKit) return;
    const { id, topic } = pendingRequest;
    try {
      await walletKit.respondSessionRequest({ topic, response: { id, jsonrpc: "2.0", error: wcUtilsRef.current.getSdkError("USER_REJECTED") } });
    } catch {
      /* ignore */
    }
    setPendingRequest(null);
  }, [pendingRequest, walletKit]);

  const disconnectSession = useCallback(
    async (topic) => {
      if (!walletKit) return;
      try {
        await walletKit.disconnectSession({ topic, reason: wcUtilsRef.current.getSdkError("USER_DISCONNECTED") });
      } catch {
        /* ignore */
      }
      const map = readJSON(WC_WALLETS_KEY, {});
      delete map[topic];
      writeJSON(WC_WALLETS_KEY, map);
      setSessionsVersion((v) => v + 1);
    },
    [walletKit]
  );

  /* ---------------- context value ---------------- */
  const value = {
    // lifecycle
    stage, unlock, lock, resetAll, addWallet, switchWallet, switching, renameWallet, setWalletAvatar, removeWallet, decryptForBackup,
    // wallets
    vault, wallets, activeEntry, activeKeys, walletChains, opened,
    // nav
    route, nav, back, goTab, sheet, openSheet, closeSheet,
    // prefs & tokens
    prefs, setPrefs, tokenStore, addToken, removeToken, toggleHidden, networkFilter, setNetworkFilter,
    // portfolio
    allAssets, visibleAssets, total, walletTotals, balances, balancesLoaded, pricesReady, prices,
    refreshBalances: (force = true) => activeId && refreshBalances(activeId, { force }),
    // chain access
    getEvmProvider, getSolanaConnection, getSigner, getActivity,
    // ui
    toast, showToast, copyText, hasAlchemyKey: !!ALCHEMY_API_KEY,
    // walletconnect
    walletKit, sessionsVersion, sessionWallet, pendingProposal, pendingRequest, pairUri, approveProposal, rejectProposal, approveRequest, rejectRequest, disconnectSession,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

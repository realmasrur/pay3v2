"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, ArrowUpRight, QrCode, EyeOff, Eye, Trash2, ClipboardPaste } from "lucide-react";
import { useApp } from "../AppProvider";
import { ChainBadge, CoinLogo, Sheet, Spinner, ErrorLine, Warn } from "../ui";
import AssetRow from "../AssetRow";
import { CHAINS } from "../../lib/chains";
import { short, formatAmount, formatFiat, formatPct } from "../../lib/format";
import { fetchTokenMeta, fetchTokenBalance, normalizeTokenAddress, guessAddressFamily, assetId, POPULAR_TOKENS } from "../../lib/tokens";
import { addressOnChain } from "../../lib/chains";

/* ------------------------------------------------------------------ */
/*  Network filter                                                      */
/* ------------------------------------------------------------------ */

export function NetworkSheet() {
  const { walletChains, networkFilter, setNetworkFilter, closeSheet } = useApp();
  const pick = (k) => {
    setNetworkFilter(k);
    closeSheet();
  };
  return (
    <Sheet title="Networks" onClose={closeSheet}>
      <div className="p3-list">
        <button className="p3-listrow" onClick={() => pick("all")}>
          <span className="p3-chain-mono">All</span>
          <span className="grow"><span className="t">All networks</span></span>
          {networkFilter === "all" && <Check size={18} className="p3-accent" />}
        </button>
        {walletChains.map((k) => (
          <button key={k} className="p3-listrow" onClick={() => pick(k)}>
            <ChainBadge chain={k} size={36} />
            <span className="grow">
              <span className="t">{CHAINS[k].name}</span>
              <span className="s">{CHAINS[k].symbol}</span>
            </span>
            {networkFilter === k && <Check size={18} className="p3-accent" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Asset detail                                                        */
/* ------------------------------------------------------------------ */

export function AssetSheet({ params }) {
  const { allAssets, prefs, closeSheet, nav, copyText, toggleHidden, removeToken } = useApp();
  const asset = allAssets.find((a) => a.id === params.id);
  if (!asset) return null;
  const def = CHAINS[asset.chain];
  const up = (asset.change ?? 0) >= 0;

  return (
    <Sheet title={asset.name} onClose={closeSheet}>
      <div className="p3-asset-hero">
        <CoinLogo asset={asset} size={64} />
        <div className="amt">
          {formatAmount(asset.balance, 8)} <span>{asset.symbol}</span>
        </div>
        <div className="fiat">{asset.value == null ? "No price available" : formatFiat(asset.value, prefs.currency)}</div>
      </div>

      <div className="p3-switch-actions">
        <button className="p3-btn soft" onClick={() => { closeSheet(); nav("send", { assetId: asset.id }); }}>
          <ArrowUpRight size={18} /> Send
        </button>
        <button className="p3-btn soft" onClick={() => { closeSheet(); nav("receive", { chain: asset.chain }); }}>
          <QrCode size={18} /> Receive
        </button>
      </div>

      <div className="p3-detail">
        <div className="row">
          <span className="k">Network</span>
          <span className="v"><ChainBadge chain={asset.chain} size={16} /> {def.name}</span>
        </div>
        {asset.price != null && (
          <div className="row">
            <span className="k">Price</span>
            <span className="v">
              {formatFiat(asset.price, prefs.currency)}
              {asset.change != null && <em className={up ? "up" : "down"}> {up ? "▲" : "▼"} {formatPct(asset.change)}</em>}
            </span>
          </div>
        )}
        {asset.address && (
          <div className="row">
            <span className="k">{def.type === "solana" ? "Mint" : "Contract"}</span>
            <span className="v">
              {short(asset.address, 6, 6)}
              <button className="p3-iconlink" onClick={() => copyText(asset.address, "Address copied")} aria-label="Copy address"><Copy size={14} /></button>
              <a className="p3-iconlink" href={def.explorerToken(asset.address)} target="_blank" rel="noopener noreferrer" aria-label="Open in explorer"><ExternalLink size={14} /></a>
            </span>
          </div>
        )}
        {asset.custom && !asset.verified && <p className="p3-help">Imported by you. Pay3 hasn't verified this token — only trust coins you recognise.</p>}
      </div>

      <div className="p3-rowbtns">
        <button className="p3-btn outline" onClick={() => { toggleHidden(asset.id); closeSheet(); }}>
          {asset.hidden ? <Eye size={16} /> : <EyeOff size={16} />} {asset.hidden ? "Show coin" : "Hide coin"}
        </button>
        {asset.custom && (
          <button className="p3-btn danger" onClick={() => { removeToken(asset.id); closeSheet(); }}>
            <Trash2 size={16} /> Remove
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Asset picker (Send)                                                 */
/* ------------------------------------------------------------------ */

export function AssetPickerSheet({ onPick, onClose, selectedId }) {
  const { allAssets, prefs } = useApp();
  const rows = allAssets
    .filter((a) => !a.hidden)
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || b.balance - a.balance);
  return (
    <Sheet title="Select a coin" onClose={onClose}>
      <div className="p3-assetlist">
        {rows.map((a) => (
          <AssetRow
            key={a.id}
            asset={a}
            currency={prefs.currency}
            showChange={false}
            onClick={() => onPick(a)}
            trailing={a.id === selectedId ? <Check size={18} className="p3-accent" /> : <span className="p3-dim">{a.balance > 0 ? formatFiat(a.value ?? 0, prefs.currency) : ""}</span>}
          />
        ))}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom coin import                                                  */
/* ------------------------------------------------------------------ */

export function AddCoinSheet({ params }) {
  const { closeSheet, walletChains, networkFilter, activeEntry, tokenStore, addToken, getEvmProvider, getSolanaConnection, showToast } = useApp();

  const initial = params?.address || "";
  const family = guessAddressFamily(initial);
  const firstEvm = walletChains.find((c) => CHAINS[c].type === "evm");
  const startChain =
    params?.chain && walletChains.includes(params.chain)
      ? params.chain
      : family === "solana" && walletChains.includes("solana")
      ? "solana"
      : networkFilter !== "all" && walletChains.includes(networkFilter)
      ? networkFilter
      : firstEvm || walletChains[0];

  const [chain, setChain] = useState(startChain);
  const [input, setInput] = useState(initial);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [balance, setBalance] = useState(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState("18");
  const [logoUrl, setLogoUrl] = useState("");

  const address = normalizeTokenAddress(chain, input);
  const id = address ? assetId(chain, address) : null;
  const already = id && tokenStore.custom.some((t) => t.id === id);
  const popular = id && POPULAR_TOKENS.find((p) => p.id === id);
  const verified = !!popular && popular.symbol.toLowerCase() === symbol.trim().toLowerCase();

  useEffect(() => {
    setMeta(null);
    setBalance(null);
    setError("");
    if (!input.trim()) {
      setStatus("idle");
      return undefined;
    }
    if (!address) {
      setStatus("error");
      setError(`That isn't a valid ${CHAINS[chain].type === "solana" ? "Solana token mint" : "contract"} address.`);
      return undefined;
    }
    let cancelled = false;
    setStatus("loading");
    const t = window.setTimeout(async () => {
      try {
        const m = await fetchTokenMeta({ chain, address, getEvmProvider, getSolanaConnection });
        if (cancelled) return;
        setMeta(m);
        setName(m.name);
        setSymbol(m.symbol);
        setDecimals(String(m.decimals));
        setStatus("ready");
        const owner = addressOnChain(activeEntry, chain);
        if (owner) {
          fetchTokenBalance({ asset: { chain, address, decimals: m.decimals }, owner, getEvmProvider, getSolanaConnection })
            .then((b) => !cancelled && setBalance(b))
            .catch(() => {});
        }
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e?.message?.startsWith("There's no") || e?.message?.startsWith("That ") ? e.message : "Couldn't read this token. Check the network and address, and your connection.");
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, input]);

  const decNum = Number(decimals);
  const logoOk = !logoUrl.trim() || /^https:\/\/\S+$/i.test(logoUrl.trim());
  const canAdd = status === "ready" && !already && symbol.trim() && Number.isInteger(decNum) && decNum >= 0 && decNum <= 36 && logoOk;

  const handleAdd = () => {
    addToken({ chain, address, symbol: symbol.trim().slice(0, 14), name: (name || symbol).trim().slice(0, 40), decimals: decNum, logo: logoUrl.trim(), verified });
    showToast("success", `${symbol.trim()} added`);
    closeSheet();
  };

  const paste = async () => {
    try {
      setInput((await navigator.clipboard.readText()).trim());
    } catch {
      /* clipboard blocked — user can paste manually */
    }
  };

  return (
    <Sheet title="Add custom coin" onClose={closeSheet} tall>
      <div className="p3-field">
        <label>Network</label>
        <div className="p3-chips wrap">
          {walletChains.map((k) => (
            <button key={k} className={`p3-chip ${chain === k ? "active" : ""}`} onClick={() => setChain(k)}>
              <ChainBadge chain={k} size={16} /> {CHAINS[k].name}
            </button>
          ))}
        </div>
      </div>

      <div className="p3-field">
        <label>{CHAINS[chain].type === "solana" ? "Token mint address" : "Token contract address"}</label>
        <div className="p3-inputwrap">
          <input
            className="p3-input mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={CHAINS[chain].type === "solana" ? "Mint address…" : "0x…"}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            style={{ paddingRight: 48 }}
          />
          <button className="p3-inputbtn" onClick={paste} aria-label="Paste" type="button">
            <ClipboardPaste size={16} />
          </button>
        </div>
      </div>

      {status === "loading" && (
        <div className="p3-lookup"><Spinner /> Reading token from {CHAINS[chain].name}…</div>
      )}
      <ErrorLine>{status === "error" ? error : ""}</ErrorLine>

      {status === "ready" && (
        <>
          <div className="p3-preview">
            <CoinLogo asset={{ chain, address, symbol: symbol || "?", logo: logoUrl.trim(), verified }} size={52} />
            <div className="mid">
              <div className="n">{name || symbol || "Unnamed token"} {verified && <span className="p3-tag ok">Verified</span>}</div>
              <div className="s">
                {symbol || "—"} · {decNum} decimals{balance != null && ` · you hold ${formatAmount(balance)}`}
              </div>
            </div>
          </div>

          {meta?.partial && <p className="p3-help">This token doesn't publish a {!meta.name && !meta.symbol ? "name or symbol" : !meta.symbol ? "symbol" : "name"} on-chain — fill it in below.</p>}

          <div className="p3-two">
            <div className="p3-field">
              <label>Symbol</label>
              <input className="p3-input" value={symbol} onChange={(e) => setSymbol(e.target.value)} maxLength={14} />
            </div>
            <div className="p3-field">
              <label>Name</label>
              <input className="p3-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            </div>
          </div>
          <div className="p3-field">
            <label>Logo URL <span className="p3-opt">optional</span></label>
            <input className="p3-input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" inputMode="url" />
            <p className="p3-help" style={{ marginTop: 6 }}>
              {logoOk ? "Pay3 looks the logo up in the Trust Wallet assets repo by contract address; paste a link here to override it." : "Logo links must start with https://"}
            </p>
          </div>

          {already && <ErrorLine>This coin is already in your list.</ErrorLine>}
          <Warn>Anyone can create a token with any name or logo. Only add coins you trust — importing one doesn't make it safe.</Warn>
          <button className="p3-btn primary" disabled={!canAdd} onClick={handleAdd}>
            Add coin
          </button>
        </>
      )}
    </Sheet>
  );
}

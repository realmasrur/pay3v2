"use client";

import { useState } from "react";
import { Search, Plus, Eye, EyeOff, X } from "lucide-react";
import { useApp } from "../AppProvider";
import { CoinLogo, Header, Spinner } from "../ui";
import AssetRow from "../AssetRow";
import { CHAINS } from "../../lib/chains";
import { fetchTokenMeta, guessAddressFamily, POPULAR_TOKENS } from "../../lib/tokens";

/** "Search" tab: find your coins, add popular ones in one tap, or import a custom coin. */
export default function AssetsScreen() {
  const { allAssets, walletChains, tokenStore, prefs, openSheet, toggleHidden, addToken, getEvmProvider, getSolanaConnection, showToast } = useApp();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(null);
  const q = query.trim().toLowerCase();
  const matches = (a) => !q || a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q) || CHAINS[a.chain].name.toLowerCase().includes(q);

  const mine = allAssets.filter(matches);
  const popular = POPULAR_TOKENS.filter((t) => walletChains.includes(t.chain) && !tokenStore.custom.some((c) => c.id === t.id) && matches(t));
  const looksLikeAddress = !!guessAddressFamily(query);

  const addPopular = async (t) => {
    setAdding(t.id);
    try {
      // Re-verify on-chain so a wrong catalog entry can never be saved silently.
      const meta = await fetchTokenMeta({ chain: t.chain, address: t.address, getEvmProvider, getSolanaConnection });
      if (meta.symbol && meta.symbol.toUpperCase() !== t.symbol.toUpperCase()) {
        showToast("error", `On-chain symbol is ${meta.symbol}, not ${t.symbol} — not added`);
      } else {
        addToken({ ...t, decimals: meta.decimals });
        showToast("success", `${t.symbol} added on ${CHAINS[t.chain].name}`);
      }
    } catch {
      showToast("error", "Couldn't verify that token right now");
    }
    setAdding(null);
  };

  return (
    <div>
      <Header title="Search" />
      <div className="p3-pad">
        <div className="p3-searchinput">
          <Search size={19} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search coins, networks or paste a contract" autoCapitalize="off" spellCheck={false} />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear">
              <X size={17} />
            </button>
          )}
        </div>

        {looksLikeAddress && (
          <button className="p3-linkcard accent" onClick={() => openSheet("addCoin", { address: query.trim() })}>
            <span className="ic"><Plus size={18} /></span>
            <span className="grow">Import token at this address</span>
          </button>
        )}

        <button className="p3-dashbtn" onClick={() => openSheet("addCoin")}>
          <Plus size={18} /> Add custom coin
        </button>

        <div className="p3-sectionlabel">Your coins</div>
        <div className="p3-assetlist">
          {mine.length === 0 && <p className="p3-help center">No coins match “{query}”.</p>}
          {mine.map((a) => (
            <AssetRow
              key={a.id}
              asset={{ ...a }}
              currency={prefs.currency}
              showChange={false}
              onClick={() => openSheet("asset", { id: a.id })}
              trailing={
                <button
                  className="p3-roundbtn sm"
                  aria-label={a.hidden ? "Show coin" : "Hide coin"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHidden(a.id);
                  }}
                >
                  {a.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          ))}
        </div>

        {popular.length > 0 && (
          <>
            <div className="p3-sectionlabel">Popular coins</div>
            <div className="p3-assetlist">
              {popular.map((t) => (
                <div className="p3-assetrow" key={t.id}>
                  <CoinLogo asset={t} size={46} />
                  <div className="mid">
                    <div className="n">{t.name}</div>
                    <div className="s">{t.symbol} · {CHAINS[t.chain].name}</div>
                  </div>
                  <button className="p3-btn soft sm" disabled={adding === t.id} onClick={() => addPopular(t)}>
                    {adding === t.id ? <Spinner size={15} /> : "Add"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, Check, Copy, ExternalLink, History, RefreshCw, Send } from "lucide-react";
import { useApp } from "../AppProvider";
import { CoinLogo, Empty, Header, NetworkChips, Sheet } from "../ui";
import { CHAINS } from "../../lib/chains";
import { dayLabel, formatAmount, formatFiatShort, short, timeLabel } from "../../lib/format";
import { checksum } from "../../lib/address";

function rowAsset(tx) {
  return {
    chain: tx.chain,
    address: tx.tokenAddress ? (CHAINS[tx.chain].type === "solana" ? tx.tokenAddress : checksum(tx.tokenAddress)) : null,
    symbol: tx.symbol,
  };
}

export default function ActivityScreen() {
  const { walletChains, networkFilter, setNetworkFilter, getActivity, allAssets, prefs, activeEntry, copyText } = useApp();
  const [filter, setFilter] = useState(networkFilter);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [nonce, setNonce] = useState(0);

  const chains = filter === "all" ? walletChains : [filter];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(chains.map((c) => getActivity(c, { force: nonce > 0 }))).then((lists) => {
      if (cancelled) return;
      setRows(lists.flat().sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, activeEntry.id, nonce]);

  const priceOf = (tx) => {
    const a = allAssets.find((x) => x.chain === tx.chain && (tx.tokenAddress ? x.address && x.address.toLowerCase() === tx.tokenAddress.toLowerCase() : x.native));
    return a?.price ?? null;
  };

  const groups = useMemo(() => {
    const out = [];
    for (const r of rows) {
      const label = dayLabel(r.ts);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(r);
      else out.push({ label, items: [r] });
    }
    return out;
  }, [rows]);

  return (
    <div>
      <Header
        title="Activity"
        right={
          <button className="p3-roundbtn sm" onClick={() => setNonce((n) => n + 1)} aria-label="Refresh">
            <RefreshCw size={16} className={loading ? "p3-spin" : ""} />
          </button>
        }
      />
      <div className="p3-pad tight">
        <NetworkChips
          all
          chains={walletChains}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setNetworkFilter(v);
          }}
        />
      </div>

      <div className="p3-pad">
        {loading && rows.length === 0 && (
          <>
            <div className="p3-skel row" />
            <div className="p3-skel row" />
            <div className="p3-skel row" />
          </>
        )}
        {!loading && rows.length === 0 && <Empty icon={History}>No activity yet{filter === "all" ? "" : ` on ${CHAINS[filter].name}`}.</Empty>}

        {groups.map((g) => (
          <div key={g.label}>
            <div className="p3-daylabel">{g.label}</div>
            {g.items.map((tx) => {
              const isIn = tx.direction === "in";
              const failed = tx.status === "failed";
              const price = priceOf(tx);
              const amt = tx.value == null ? null : `${formatAmount(tx.value)} ${tx.symbol}`;
              return (
                <button key={tx.id} className="p3-txrow" onClick={() => setSelected(tx)}>
                  <CoinLogo
                    asset={rowAsset(tx)}
                    size={46}
                    corner={<span className={`p3-dirbadge ${isIn ? "in" : ""}`}>{isIn ? <ArrowDownLeft size={11} strokeWidth={3} /> : <Send size={10} strokeWidth={2.6} />}</span>}
                  />
                  <span className="mid">
                    <span className={`n ${failed ? "bad" : ""}`}>{isIn ? "Received" : "Sent"}</span>
                    <span className={`s ${failed ? "bad" : ""}`}>{failed ? "Failed" : `${isIn ? "From" : "To"} ${short(isIn ? tx.from : tx.to)}`}</span>
                  </span>
                  <span className="right">
                    <span className="n">{failed ? "--" : price != null ? formatFiatShort(tx.value * price, prefs.currency) : amt}</span>
                    <span className="s">{failed ? "--" : price != null ? amt : CHAINS[tx.chain].name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selected && (
        <Sheet title="Receipt" onClose={() => setSelected(null)}>
          <div className="p3-receipt-head">
            <span className={`p3-pill ${selected.status === "failed" ? "bad" : "ok"}`}>
              {selected.status === "failed" ? "Failed" : (<><Check size={12} /> Confirmed</>)}
            </span>
            <div className="amt">
              {selected.value == null ? "—" : `${selected.direction === "in" ? "+" : "−"}${formatAmount(selected.value, 8)} ${selected.symbol}`}
            </div>
            {selected.ts && <div className="when">{timeLabel(selected.ts)}</div>}
          </div>
          <div className="p3-detail">
            {[
              ["Network", CHAINS[selected.chain].name],
              ["From", selected.from],
              ["To", selected.to],
              [selected.chain === "solana" ? "Slot" : "Block", selected.hexBlock ? parseInt(selected.blockNum, 16) : selected.blockNum],
              ["Hash", selected.hash],
            ].map(([k, v]) => (
              <div className="row" key={k}>
                <span className="k">{k}</span>
                <span className="v">
                  {typeof v === "string" && v.length > 20 ? short(v) : v || "—"}
                  {typeof v === "string" && v.length > 20 && (
                    <button className="p3-iconlink" onClick={() => copyText(v)} aria-label={`Copy ${k}`}><Copy size={13} /></button>
                  )}
                </span>
              </div>
            ))}
          </div>
          <a href={CHAINS[selected.chain].explorerTx(selected.hash)} target="_blank" rel="noopener noreferrer" className="p3-btn primary linkbtn">
            View on {CHAINS[selected.chain].explorerName} <ExternalLink size={15} />
          </a>
        </Sheet>
      )}
    </div>
  );
}

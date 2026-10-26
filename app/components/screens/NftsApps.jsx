"use client";

import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Link2, Unplug } from "lucide-react";
import { useApp } from "../AppProvider";
import { Empty, Header, NetworkChips } from "../ui";
import { ALCHEMY_API_KEY, CHAINS, EVM_CHAINS } from "../../lib/chains";

export function NftsScreen() {
  const { back, activeEntry, walletChains, networkFilter } = useApp();
  const evmChains = EVM_CHAINS.filter((c) => walletChains.includes(c));
  const [chainKey, setChainKey] = useState(evmChains.includes(networkFilter) ? networkFilter : evmChains[0]);
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chainKey || !activeEntry?.evmAddress || !ALCHEMY_API_KEY) {
      setNfts([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setNfts([]);
    fetch(`https://${CHAINS[chainKey].alchemySlug}.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner?owner=${activeEntry.evmAddress}&withMetadata=true&pageSize=24&excludeFilters[]=SPAM`)
      .then((r) => r.json())
      .then((d) => !cancelled && setNfts(d?.ownedNfts || []))
      .catch(() => !cancelled && setNfts([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [chainKey, activeEntry?.evmAddress]);

  return (
    <div>
      <Header title="NFTs" onBack={back} />
      <div className="p3-pad">
        {!chainKey ? (
          <Empty icon={ImageIcon}>This wallet has no EVM address, so there are no NFTs to show.</Empty>
        ) : (
          <>
            <NetworkChips chains={evmChains} value={chainKey} onChange={setChainKey} />
            {loading && (
              <div className="p3-nftgrid">
                {[0, 1, 2, 3].map((i) => <div key={i} className="p3-skel nft" />)}
              </div>
            )}
            {!loading && nfts.length === 0 && <Empty icon={ImageIcon}>No NFTs found on {CHAINS[chainKey].name} for this wallet.</Empty>}
            <div className="p3-nftgrid">
              {nfts.map((n, i) => {
                const img = n?.image?.cachedUrl || n?.image?.thumbnailUrl || n?.image?.originalUrl;
                const name = n?.name || n?.contract?.name || `#${n?.tokenId}`;
                return (
                  <div className="p3-nftcard" key={`${n?.contract?.address}-${n?.tokenId}-${i}`}>
                    {img ? <img className="thumb" src={img} alt={name} loading="lazy" /> : <div className="thumb empty"><ImageIcon size={22} /></div>}
                    <div className="meta">
                      <div className="name">{name}</div>
                      <div className="coll">{n?.contract?.name || "Unknown collection"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AppsScreen() {
  const { walletKit, sessionsVersion, openSheet, disconnectSession, sessionWallet, wallets } = useApp();
  const sessions = useMemo(() => {
    if (!walletKit?.getActiveSessions) return [];
    try {
      return Object.values(walletKit.getActiveSessions());
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKit, sessionsVersion]);

  return (
    <div>
      <Header title="Apps" />
      <div className="p3-pad">
        <button className="p3-btn primary" onClick={() => openSheet("connect")}>
          <Link2 size={18} /> Connect a new app
        </button>

        {sessions.length === 0 ? (
          <Empty icon={Unplug}>No connected apps yet. Tap “Connect a new app” and scan or paste a site's WalletConnect link.</Empty>
        ) : (
          <div className="p3-menu list" style={{ marginTop: 18 }}>
            {sessions.map((s) => {
              const meta = s.peer?.metadata || {};
              const walletName = wallets.find((w) => w.id === sessionWallet(s.topic))?.name;
              return (
                <div className="p3-menuitem static" key={s.topic}>
                  {meta.icons?.[0] ? <img src={meta.icons[0]} alt="" className="p3-appicon" style={{ width: 38, height: 38 }} /> : <span className="p3-chain-mono" style={{ width: 38, height: 38 }}><Link2 size={16} /></span>}
                  <span className="grow">
                    <span className="t">{meta.name || "Connected app"}</span>
                    <span className="s">{walletName ? `${walletName} · ` : ""}{meta.url}</span>
                  </span>
                  <button className="p3-roundbtn sm" onClick={() => disconnectSession(s.topic)} aria-label="Disconnect"><Unplug size={16} /></button>
                </div>
              );
            })}
          </div>
        )}
        <p className="p3-help center" style={{ marginTop: 18 }}>
          Connected apps can ask you to sign messages or send transactions — Pay3 always asks you to approve each one first. Each connection is tied to the wallet that approved it.
        </p>
      </div>
    </div>
  );
}

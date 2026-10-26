"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Link2, Plus, QrCode, ScanLine, Search, Send, X, Image as ImageIcon, Wallet } from "lucide-react";
import { useApp } from "../AppProvider";
import { Avatar, Empty } from "../ui";
import AssetRow from "../AssetRow";
import ScannerOverlay from "../Scanner";
import { CHAINS } from "../../lib/chains";
import { formatFiat } from "../../lib/format";
import { guessAddressFamily } from "../../lib/tokens";
import { extractAddress } from "../../lib/address";

const PROMO_KEY = "pay3_promo_dismissed_v1";
const PROMO_SLIDES = ["/slider1.jpg", "/slider2.jpg"];

function PromoCard() {
  const [dismissed, setDismissed] = useState(true);
  const [i, setI] = useState(0);
  const [broken, setBroken] = useState({});

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(PROMO_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  useEffect(() => {
    if (dismissed) return undefined;
    const t = window.setInterval(() => setI((n) => (n + 1) % PROMO_SLIDES.length), 5000);
    return () => window.clearInterval(t);
  }, [dismissed]);

  const live = PROMO_SLIDES.map((s, idx) => idx).filter((idx) => !broken[idx]);
  if (dismissed || !live.length) return null;
  const cur = live.includes(i) ? i : live[0];

  return (
    <div className="p3-promo">
      {PROMO_SLIDES.map((src, idx) =>
        broken[idx] ? null : <img key={src} src={src} alt="" className={idx === cur ? "on" : ""} onError={() => setBroken((b) => ({ ...b, [idx]: true }))} />
      )}
      <button
        className="p3-promo-x"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(PROMO_KEY, "1");
          } catch {
            /* ignore */
          }
        }}
      >
        <X size={15} />
      </button>
      {live.length > 1 && (
        <div className="p3-promo-dots">
          {live.map((idx) => (
            <span key={idx} className={idx === cur ? "on" : ""} onClick={() => setI(idx)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionTile({ icon: Icon, label, onClick }) {
  return (
    <button className="p3-tile" onClick={onClick}>
      <Icon size={26} strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  );
}

export default function HomeScreen() {
  const { activeEntry, prefs, setPrefs, total, visibleAssets, balancesLoaded, networkFilter, openSheet, nav, goTab, pairUri, showToast } = useApp();
  const [scanOpen, setScanOpen] = useState(false);
  const hide = prefs.hideBalance;

  const smartInput = (text) => {
    const t = (text || "").trim();
    if (!t) return;
    if (t.toLowerCase().startsWith("wc:")) return pairUri(t);
    const family = guessAddressFamily(t);
    if (family) return openSheet("addCoin", { address: t });
    showToast("error", "Paste a coin contract address or a WalletConnect link");
  };
  const paste = async () => {
    try {
      smartInput(await navigator.clipboard.readText());
    } catch {
      showToast("error", "Couldn't read the clipboard");
    }
  };

  const scanned = (text) => {
    setScanOpen(false);
    const t = (text || "").trim();
    if (t.toLowerCase().startsWith("wc:")) return pairUri(t);
    nav("send", { to: t });
  };
  const scanValidate = (text) => {
    const t = (text || "").trim();
    if (t.toLowerCase().startsWith("wc:")) return t;
    const evm = extractAddress(t, CHAINS.ethereum);
    if (evm) return evm;
    return extractAddress(t, CHAINS.solana);
  };

  return (
    <div className="p3-home">
      <div className="p3-homebar">
        <button className="p3-avatarbtn" onClick={() => openSheet("wallets")} aria-label="Wallets">
          <Avatar entry={activeEntry} size={40} />
        </button>
        <h1>Home</h1>
        <div className="grow" />
        <button className="p3-ghosticon" onClick={() => setPrefs({ hideBalance: !hide })} aria-label={hide ? "Show balances" : "Hide balances"}>
          {hide ? <EyeOff size={24} /> : <Eye size={24} />}
        </button>
        <button className="p3-ghosticon" onClick={() => setScanOpen(true)} aria-label="Scan QR code">
          <ScanLine size={26} />
        </button>
      </div>

      <div className="p3-balance">
        <div className="amt">{hide ? "••••••" : balancesLoaded ? formatFiat(total, prefs.currency) : <span className="p3-skel big" />}</div>
        <button className="p3-walletpill" onClick={() => openSheet("wallets")}>
          {activeEntry.name} <ChevronDown size={16} />
        </button>
      </div>

      <div className="p3-tiles">
        <ActionTile icon={Plus} label="Add coin" onClick={() => openSheet("addCoin")} />
        <ActionTile icon={QrCode} label="Receive" onClick={() => nav("receive")} />
        <ActionTile icon={Send} label="Send" onClick={() => nav("send")} />
        <ActionTile icon={Link2} label="Connect" onClick={() => openSheet("connect")} />
      </div>

      <div className="p3-searchbar" onClick={() => goTab("assets")} role="search">
        <Search size={20} />
        <span>Search assets or paste address</span>
        <button
          className="p3-pastechip"
          onClick={(e) => {
            e.stopPropagation();
            paste();
          }}
        >
          PASTE
        </button>
      </div>

      <PromoCard />

      <div className="p3-sectionhead">
        <button className="p3-sectiontitle" onClick={() => goTab("assets")}>
          Coins <ChevronRight size={20} />
        </button>
        <button className="p3-netpill" onClick={() => openSheet("network")}>
          {networkFilter === "all" ? "All networks" : CHAINS[networkFilter].name} <ChevronDown size={14} />
        </button>
      </div>

      <div className="p3-assetlist">
        {!balancesLoaded && visibleAssets.length === 0 && (
          <>
            <div className="p3-skel row" />
            <div className="p3-skel row" />
          </>
        )}
        {balancesLoaded && visibleAssets.length === 0 && (
          <Empty icon={Wallet}>No coins here yet. Receive some, or add a coin by its contract address.</Empty>
        )}
        {visibleAssets.map((a) => (
          <AssetRow key={a.id} asset={a} currency={prefs.currency} hide={hide} onClick={() => openSheet("asset", { id: a.id })} />
        ))}
      </div>

      <button className="p3-linkcard" onClick={() => openSheet("addCoin")}>
        <span className="ic"><Plus size={18} /></span>
        <span className="grow">Add custom coin</span>
        <ChevronRight size={18} />
      </button>
      <button className="p3-linkcard" onClick={() => nav("nfts")}>
        <span className="ic"><ImageIcon size={18} /></span>
        <span className="grow">NFTs</span>
        <ChevronRight size={18} />
      </button>

      {scanOpen && <ScannerOverlay title="Scan address or WalletConnect code" validate={scanValidate} onResult={scanned} onClose={() => setScanOpen(false)} />}
    </div>
  );
}

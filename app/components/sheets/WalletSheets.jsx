"use client";

import { Settings, X, Copy, User, QrCode, SlidersHorizontal, Check, KeyRound, FileText, Sparkles, ChevronRight } from "lucide-react";
import { useApp } from "../AppProvider";
import { Avatar, Sheet, Spinner } from "../ui";
import { short, formatFiat } from "../../lib/format";

export function WalletSwitcherSheet() {
  const { wallets, activeEntry, walletTotals, prefs, switchWallet, closeSheet, openSheet, nav, copyText } = useApp();
  const addr = activeEntry.evmAddress || activeEntry.solAddress;

  return (
    <div className="p3-overlay" onClick={closeSheet}>
      <div className="p3-sheet wallets" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Wallets">
        <div className="p3-sheet-toprow">
          <button
            className="p3-roundbtn"
            aria-label="Settings"
            onClick={() => {
              closeSheet();
              nav("settings");
            }}
          >
            <Settings size={18} />
          </button>
          <button className="p3-roundbtn" onClick={closeSheet} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p3-switch-hero">
          <Avatar entry={activeEntry} size={84} />
          <h3>{activeEntry.name}</h3>
          <button className="p3-addrchip" onClick={() => copyText(addr, "Address copied")}>
            {short(addr)} <Copy size={13} />
          </button>
        </div>

        <div className="p3-switch-actions">
          <button
            className="p3-btn soft"
            onClick={() => {
              closeSheet();
              nav("wallet", { id: activeEntry.id });
            }}
          >
            <User size={18} /> Profile
          </button>
          <button
            className="p3-btn soft"
            onClick={() => {
              closeSheet();
              nav("receive");
            }}
          >
            <QrCode size={18} /> Receive
          </button>
        </div>

        <div className="p3-divider" />
        <div className="p3-sheet-label">Your Wallets</div>

        <div className="p3-walletlist">
          {wallets.map((w) => {
            const active = w.id === activeEntry.id;
            const total = walletTotals[w.id];
            return (
              <div key={w.id} className={`p3-walletrow ${active ? "active" : ""}`} onClick={() => switchWallet(w.id)}>
                <span className="p3-walletrow-av">
                  <Avatar entry={w} size={52} />
                  {active && (
                    <span className="p3-checkbadge">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <div className="mid">
                  <div className="n">{w.name}</div>
                  <div className="s">{total == null ? <span className="p3-skel inline" /> : formatFiat(total, prefs.currency)}</div>
                </div>
                <button
                  className="p3-roundbtn"
                  aria-label={`Manage ${w.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeSheet();
                    nav("wallet", { id: w.id });
                  }}
                >
                  <SlidersHorizontal size={17} />
                </button>
              </div>
            );
          })}
        </div>

        <button className="p3-btn primary big" onClick={() => openSheet("addWallet")}>
          Add Wallet
        </button>
      </div>
    </div>
  );
}

export function AddWalletSheet() {
  const { closeSheet, nav } = useApp();
  const go = (mode) => {
    closeSheet();
    nav("addWallet", { mode });
  };
  const items = [
    { mode: "create", icon: Sparkles, title: "Create a new wallet", sub: "Generate a fresh 12-word recovery phrase" },
    { mode: "phrase", icon: FileText, title: "Import recovery phrase", sub: "12 or 24 words · EVM + Solana" },
    { mode: "evmkey", icon: KeyRound, title: "Import EVM private key", sub: "Ethereum, Base, Polygon and other EVM chains" },
    { mode: "solkey", icon: KeyRound, title: "Import Solana private key", sub: "Base58 or JSON byte array" },
  ];
  return (
    <Sheet title="Add a wallet" onClose={closeSheet}>
      <div className="p3-menu">
        {items.map((it) => (
          <button key={it.mode} className="p3-menuitem" onClick={() => go(it.mode)}>
            <span className="p3-menuicon">
              <it.icon size={18} />
            </span>
            <span className="grow">
              <span className="t">{it.title}</span>
              <span className="s">{it.sub}</span>
            </span>
            <ChevronRight size={16} className="chev" />
          </button>
        ))}
      </div>
      <p className="p3-help center">All wallets are encrypted on this device with the password you already use to unlock Pay3.</p>
    </Sheet>
  );
}

export function SwitchingOverlay() {
  return (
    <div className="p3-overlay center">
      <div className="p3-busycard">
        <Spinner size={26} />
        <span>Unlocking wallet…</span>
      </div>
    </div>
  );
}


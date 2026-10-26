"use client";

import { useState } from "react";
import { Check, ChevronRight, ExternalLink, Info, Smartphone, PlugZap, Trash2 } from "lucide-react";
import { useApp } from "../AppProvider";
import { Avatar, Header, Sheet } from "../ui";
import { APP_VERSION } from "../../lib/chains";
import { CURRENCIES } from "../../lib/format";

function Row({ icon: Icon, title, sub, onClick, right, href, danger }) {
  const body = (
    <>
      {Icon && <span className={`p3-menuicon ${danger ? "danger" : ""}`}><Icon size={20} /></span>}
      <span className="grow">
        <span className="t">{title}</span>
        {sub && <span className="s">{sub}</span>}
      </span>
      {right}
      {(onClick || href) && !right && (href ? <ExternalLink size={16} className="chev" /> : <ChevronRight size={18} className="chev" />)}
    </>
  );
  if (href) return <a className="p3-menuitem" href={href} target="_blank" rel="noopener noreferrer">{body}</a>;
  return <button className={`p3-menuitem ${danger ? "danger" : ""}`} onClick={onClick} disabled={!onClick}>{body}</button>;
}

export function SettingsScreen() {
  const { back, nav, openSheet, activeEntry, wallets, prefs, walletKit, sessionsVersion, lock, resetAll } = useApp();
  const [legalOpen, setLegalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  let sessionCount = 0;
  try {
    sessionCount = walletKit?.getActiveSessions ? Object.keys(walletKit.getActiveSessions()).length : 0;
  } catch {
    sessionCount = 0;
  }
  void sessionsVersion;

  return (
    <div>
      <Header title="Settings" onBack={back} />
      <div className="p3-pad">
        <button className="p3-cardrow" onClick={() => nav("wallet", { id: activeEntry.id })}>
          <Avatar entry={activeEntry} size={56} />
          <span className="grow">
            <span className="t">{activeEntry.name}</span>
            <span className="s">Manage wallet settings</span>
          </span>
          <ChevronRight size={20} className="chev" />
        </button>

        <button className="p3-cardrow slim" onClick={() => openSheet("wallets")}>
          <span className="grow"><span className="t">Show all wallets</span></span>
          <span className="p3-avstack">
            {wallets.slice(0, 3).map((w) => <Avatar key={w.id} entry={w} size={34} />)}
          </span>
          <ChevronRight size={20} className="chev" />
        </button>

        <div className="p3-group">Preferences</div>
        <div className="p3-menu flat">
          <Row icon={Smartphone} title="Display" sub={`${CURRENCIES[prefs.currency].code}, balances`} onClick={() => nav("display")} />
        </div>

        <div className="p3-group">Connections</div>
        <div className="p3-menu flat">
          <Row icon={PlugZap} title="Connected apps" sub={sessionCount ? `${sessionCount} connected` : "Connect to sites with WalletConnect"} onClick={() => nav("apps")} />
        </div>

        <div className="p3-group">Resources</div>
        <div className="p3-menu list">
          <Row title="Help & support" href="https://pay3.space" />
          <Row title="Legal" onClick={() => setLegalOpen(true)} />
          <Row title="Version" right={<span className="p3-dim">{APP_VERSION}</span>} />
          <Row title="Wallets on this device" right={<span className="p3-dim">{wallets.length}</span>} />
        </div>

        <div className="p3-group danger">Danger Zone</div>
        <div className="p3-menu list">
          <Row title="Lock wallet" onClick={lock} danger />
          <Row title="Remove all wallets from this device" onClick={() => setConfirmOpen(true)} danger />
        </div>

        <p className="p3-footer-note">Pay3 · pay3.space · a product of mecozx<br />Self-custody wallet — you are responsible for your recovery phrases.</p>
      </div>

      {legalOpen && (
        <Sheet title="Legal" onClose={() => setLegalOpen(false)}>
          <p className="p3-help">
            Pay3 is non-custodial software. Your keys are generated, encrypted and used on this device only; Pay3 cannot recover them, reverse transactions or access your funds.
            Token prices come from CoinGecko and balances from public blockchain RPC providers, and may be delayed or wrong. Importing a coin does not endorse it — anyone can create
            a token with any name. Nothing in this app is financial advice. Review every address and amount before you send.
          </p>
        </Sheet>
      )}
      {confirmOpen && (
        <Sheet title="Remove all wallets?" onClose={() => setConfirmOpen(false)}>
          <p className="p3-help" style={{ marginBottom: 20 }}>
            This deletes every wallet stored on this device ({wallets.length}). Without each recovery phrase or private key, the funds in them will be permanently unreachable. This cannot be undone.
          </p>
          <div className="p3-rowbtns">
            <button className="p3-btn outline" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="p3-btn danger" onClick={resetAll}><Trash2 size={16} /> Remove all</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

export function DisplayScreen() {
  const { back, prefs, setPrefs } = useApp();
  return (
    <div>
      <Header title="Display" onBack={back} />
      <div className="p3-pad">
        <div className="p3-group first">Currency</div>
        <div className="p3-menu list">
          {Object.entries(CURRENCIES).map(([k, c]) => (
            <button key={k} className="p3-menuitem" onClick={() => setPrefs({ currency: k })}>
              <span className="grow"><span className="t">{c.code}</span><span className="s">{c.name}</span></span>
              {prefs.currency === k && <Check size={19} className="p3-accent" />}
            </button>
          ))}
        </div>

        <div className="p3-group">Balances</div>
        <div className="p3-menu list">
          <label className="p3-menuitem">
            <span className="grow"><span className="t">Hide balances</span><span className="s">Show •••• instead of amounts on Home</span></span>
            <input type="checkbox" className="p3-switch" checked={prefs.hideBalance} onChange={(e) => setPrefs({ hideBalance: e.target.checked })} />
          </label>
          <label className="p3-menuitem">
            <span className="grow"><span className="t">Hide small token balances</span><span className="s">Hide imported tokens worth less than 1 {prefs.currency.toUpperCase()}</span></span>
            <input type="checkbox" className="p3-switch" checked={prefs.hideSmall} onChange={(e) => setPrefs({ hideSmall: e.target.checked })} />
          </label>
        </div>
        <p className="p3-help"><Info size={13} style={{ verticalAlign: "-2px" }} /> Prices come from CoinGecko and refresh every minute.</p>
      </div>
    </div>
  );
}


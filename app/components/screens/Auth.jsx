"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { Copy, Eye, Lock } from "lucide-react";
import { useApp } from "../AppProvider";
import { Avatar, BrandMark, ErrorLine, Header, PasswordInput, Sheet, Spinner, Warn } from "../ui";
import { WALLET_KINDS } from "../../lib/vault";

/* ------------------------------------------------------------------ */
/*  Welcome                                                             */
/* ------------------------------------------------------------------ */

export function WelcomeScreen({ onCreate, onImport }) {
  return (
    <div className="p3-authwrap">
      <div className="p3-brand">
        <BrandMark />
        Pay3
      </div>

      <div className="p3-hero-graphic">
        <div className="glow" />
        <div className="glow two" />
        <div className="tag">9 chains · self-custody · multi-wallet</div>
      </div>

      <div className="p3-welcome-copy">
        <h2>Your gateway to Web3 finance.</h2>
        <p>
          Create a wallet or import as many as you like — recovery phrases, EVM keys or Solana keys — and manage coins across Ethereum, Polygon, OP Mainnet,
          Arbitrum, Base, Zora, Mantle, Plasma and Solana.
        </p>
      </div>

      <div className="p3-welcome-actions">
        <button className="p3-btn primary" onClick={onCreate}>Create new wallet</button>
        <button className="p3-btn soft" onClick={onImport}>Import existing wallet</button>
        <div className="p3-domain">pay3.space · a product of mecozx</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Unlock                                                              */
/* ------------------------------------------------------------------ */

export function UnlockScreen() {
  const { unlock, activeEntry, resetAll } = useApp();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submit = async () => {
    if (busy || !password) return;
    setError("");
    setBusy(true);
    try {
      await unlock(password);
    } catch {
      setError("Incorrect password.");
      setBusy(false);
    }
  };

  return (
    <div className="p3-authwrap">
      <div className="p3-brand">
        <BrandMark />
        Pay3
      </div>

      <div className="p3-unlock-head">
        {activeEntry ? <Avatar entry={activeEntry} size={76} /> : <div className="p3-lockicon"><Lock size={26} /></div>}
        <h2>Welcome back</h2>
        <p className="p3-help">Enter your password to unlock{activeEntry ? ` ${activeEntry.name}` : ""}.</p>
      </div>

      <div className="p3-field" style={{ marginTop: 28 }}>
        <label>Password</label>
        <PasswordInput value={password} onChange={setPassword} placeholder="Your password" onEnter={submit} autoFocus show={showPw} onToggle={() => setShowPw((s) => !s)} />
      </div>
      <ErrorLine>{error}</ErrorLine>
      <button className="p3-btn primary" disabled={busy || !password} onClick={submit} style={{ marginTop: 8 }}>
        {busy ? <Spinner /> : "Unlock"}
      </button>

      <div className="p3-unlock-foot">
        <button className="p3-link" onClick={() => setConfirmOpen(true)}>Forgot password? Remove all wallets from this device</button>
      </div>

      {confirmOpen && (
        <Sheet title="Remove all wallets?" onClose={() => setConfirmOpen(false)}>
          <p className="p3-help" style={{ marginBottom: 20 }}>
            This deletes every encrypted wallet stored on this device. Without each wallet's recovery phrase or private key, the funds in it will be permanently unreachable. This cannot be undone.
          </p>
          <div className="p3-rowbtns">
            <button className="p3-btn outline" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="p3-btn danger" onClick={resetAll}>Remove all</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create a wallet                                                     */
/* ------------------------------------------------------------------ */

export function CreateWalletFlow({ firstRun, onBack }) {
  const { addWallet, showToast } = useApp();
  const [step, setStep] = useState(firstRun ? "password" : "name");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = () => {
    setError("");
    if (firstRun) {
      if (password.length < 8) return setError("Password must be at least 8 characters.");
      if (password !== password2) return setError("Passwords do not match.");
    }
    setPhrase(ethers.Wallet.createRandom().mnemonic.phrase);
    setStep("reveal");
  };

  const finish = async () => {
    setError("");
    setBusy(true);
    try {
      await addWallet({ kind: "phrase", secret: phrase, name, password: firstRun ? password : undefined });
    } catch (e) {
      setError(e?.message || "Couldn't secure your wallet. Please try again.");
      setBusy(false);
    }
  };

  const words = phrase ? phrase.split(" ") : [];

  return (
    <div className="p3-authwrap">
      <Header title={step === "reveal" ? "Save your recovery phrase" : firstRun ? "Set a password" : "New wallet"} onBack={onBack} />

      {step !== "reveal" && (
        <>
          {firstRun ? (
            <>
              <p className="p3-help" style={{ marginBottom: 18 }}>
                This password encrypts your wallets on this device. You'll need it every time you open Pay3 here — Pay3 cannot reset it for you.
              </p>
              <div className="p3-field">
                <label>Password</label>
                <PasswordInput value={password} onChange={setPassword} placeholder="At least 8 characters" show={showPw} onToggle={() => setShowPw((s) => !s)} />
              </div>
              <div className="p3-field">
                <label>Confirm password</label>
                <PasswordInput value={password2} onChange={setPassword2} placeholder="Re-enter password" show={showPw} />
              </div>
            </>
          ) : (
            <p className="p3-help" style={{ marginBottom: 18 }}>A new 12-word recovery phrase will be generated for this wallet. It's encrypted with your existing Pay3 password.</p>
          )}
          <div className="p3-field">
            <label>Wallet name <span className="p3-opt">optional</span></label>
            <input className="p3-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Savings" maxLength={40} />
          </div>
          <ErrorLine>{error}</ErrorLine>
          <div className="p3-bottomcta">
            <button className="p3-btn primary" onClick={generate}>Continue</button>
          </div>
        </>
      )}

      {step === "reveal" && (
        <>
          <Warn>Anyone with these 12 words can access your funds on every chain in this wallet. Write them down and store them offline — never share them, screenshot them, or paste them anywhere.</Warn>
          <div className="p3-mnemonic-box">
            <div className={`p3-mnemonic-grid ${revealed ? "revealed" : ""}`}>
              {words.map((w, i) => (
                <div className="p3-mnemonic-word" key={i}>
                  <span className="idx">{i + 1}</span>
                  {w}
                </div>
              ))}
            </div>
            {!revealed && (
              <div className="p3-reveal-overlay" onClick={() => setRevealed(true)}>
                <Eye size={16} /> Tap to reveal
              </div>
            )}
          </div>
          {revealed && (
            <button className="p3-btn ghost sm" style={{ margin: "10px auto 0" }} onClick={() => navigator.clipboard.writeText(phrase).then(() => showToast("success", "Phrase copied"))}>
              <Copy size={14} /> Copy phrase
            </button>
          )}
          <label className="p3-checkline">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            I've saved my recovery phrase somewhere safe and offline.
          </label>
          <ErrorLine>{error}</ErrorLine>
          <div className="p3-bottomcta">
            <button className="p3-btn primary" disabled={!saved || busy} onClick={finish}>
              {busy ? <Spinner /> : "Continue to wallet"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Import a wallet (phrase / EVM key / Solana key)                     */
/* ------------------------------------------------------------------ */

const IMPORT_COPY = {
  phrase: { label: "12 or 24-word phrase", placeholder: "word1 word2 word3 …", empty: "Enter your 12 or 24-word recovery phrase.", help: null },
  evmkey: {
    label: "EVM private key",
    placeholder: "0x…",
    empty: "Enter your private key.",
    help: "A private key only unlocks EVM chains (Ethereum, Polygon, OP Mainnet, Arbitrum, Base, Zora, Mantle, Plasma). Solana uses a different key type — import a recovery phrase to get both.",
  },
  solkey: {
    label: "Solana private key",
    placeholder: "Base58 string or [12,34,…] byte array",
    empty: "Enter your Solana private key.",
    help: "Accepts the base58 key exported by Phantom/Solflare or the JSON byte array from solana-keygen. This wallet will only use Solana.",
  },
};

export function ImportWalletFlow({ firstRun, initialMode = "phrase", onBack }) {
  const { addWallet } = useApp();
  const [mode, setMode] = useState(initialMode);
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("1");
  const [advanced, setAdvanced] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = IMPORT_COPY[mode];

  const submit = async () => {
    setError("");
    if (!value.trim()) return setError(copy.empty);
    if (firstRun) {
      if (password.length < 8) return setError("Password must be at least 8 characters.");
      if (password !== password2) return setError("Passwords do not match.");
    }
    const idx = Math.max(0, parseInt(account, 10) - 1 || 0);
    setBusy(true);
    try {
      await addWallet({ kind: mode, secret: value, name, index: mode === "phrase" ? idx : 0, password: firstRun ? password : undefined });
    } catch (e) {
      const msg = e?.message || "";
      setError(
        /already added|isn't valid|Enter a password/.test(msg)
          ? msg
          : mode === "phrase"
          ? "That recovery phrase looks invalid."
          : mode === "evmkey"
          ? "That private key looks invalid."
          : "That Solana key looks invalid. Use the base58 string or a 32/64-byte array."
      );
      setBusy(false);
    }
  };

  return (
    <div className="p3-authwrap">
      <Header title="Import wallet" onBack={onBack} />

      <div className="p3-tabs">
        {Object.entries(WALLET_KINDS).map(([k, v]) => (
          <button key={k} className={`p3-tab ${mode === k ? "active" : ""}`} onClick={() => { setMode(k); setError(""); }}>
            {v.short}
          </button>
        ))}
      </div>

      <div className="p3-field">
        <label>{copy.label}</label>
        <textarea className="p3-textarea mono" value={value} onChange={(e) => setValue(e.target.value)} placeholder={copy.placeholder} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </div>
      {copy.help && <p className="p3-help" style={{ marginBottom: 14 }}>{copy.help}</p>}

      <div className="p3-field">
        <label>Wallet name <span className="p3-opt">optional</span></label>
        <input className="p3-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trading" maxLength={40} />
      </div>

      {mode === "phrase" && (
        <div className="p3-field">
          <button className="p3-link left" onClick={() => setAdvanced((a) => !a)}>{advanced ? "Hide" : "Show"} advanced</button>
          {advanced && (
            <>
              <label style={{ marginTop: 10 }}>Account number</label>
              <input className="p3-input" value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
              <p className="p3-help" style={{ marginTop: 6 }}>Account 1 is the default. Use 2, 3… to import other accounts derived from the same phrase.</p>
            </>
          )}
        </div>
      )}

      {firstRun && (
        <>
          <div className="p3-field">
            <label>New password for this device</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="At least 8 characters" show={showPw} onToggle={() => setShowPw((s) => !s)} />
          </div>
          <div className="p3-field">
            <label>Confirm password</label>
            <PasswordInput value={password2} onChange={setPassword2} placeholder="Re-enter password" show={showPw} />
          </div>
        </>
      )}
      <p className="p3-help">Encrypted on this device only. It's never sent to Pay3 or anywhere else.</p>

      <ErrorLine>{error}</ErrorLine>
      <div className="p3-bottomcta">
        <button className="p3-btn primary" disabled={busy} onClick={submit}>
          {busy ? <Spinner /> : "Import wallet"}
        </button>
      </div>
    </div>
  );
}

/** Route wrapper used by Add Wallet inside the app. */
export function AddWalletScreen({ params }) {
  const { back } = useApp();
  const mode = params?.mode || "create";
  return (
    mode === "create" ? <CreateWalletFlow firstRun={false} onBack={back} /> : <ImportWalletFlow firstRun={false} initialMode={mode} onBack={back} />
  );
}

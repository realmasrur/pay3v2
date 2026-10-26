"use client";

import { useRef, useState } from "react";
import { Camera, Copy, ExternalLink, FileDown, Pencil, Plus, ShieldCheck, Trash2, Eye, Check } from "lucide-react";
import { useApp } from "../AppProvider";
import { Avatar, ErrorLine, Header, Sheet, Spinner, Warn } from "../ui";
import { CHAINS } from "../../lib/chains";
import { short } from "../../lib/format";
import { WALLET_KINDS, secretForBackup, nextFreeIndex } from "../../lib/vault";

export default function WalletManageScreen({ params }) {
  const { back, wallets, vault, activeEntry, renameWallet, setWalletAvatar, removeWallet, copyText, addWallet, opened, showToast } = useApp();
  const entry = wallets.find((w) => w.id === params.id) || activeEntry;
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.name);
  const [backupOpen, setBackupOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);

  const saveName = () => {
    renameWallet(entry.id, draft);
    setEditing(false);
  };

  const addAccount = async () => {
    const keys = opened[entry.id];
    if (!keys?.phrase) return showToast("error", "Unlock this wallet first by switching to it");
    setAddingAccount(true);
    try {
      const index = nextFreeIndex(vault, keys.phrase);
      await addWallet({ kind: "phrase", secret: keys.phrase, index, name: "" });
    } catch (e) {
      showToast("error", e?.message || "Couldn't add another account");
      setAddingAccount(false);
    }
  };

  return (
    <div>
      <Header title="Wallet" onBack={back} />
      <div className="p3-pad">
        <div className="p3-profile">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              setWalletAvatar(entry.id, e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button className="p3-avatar-upload" onClick={() => fileRef.current?.click()} aria-label="Change photo">
            <Avatar entry={entry} size={96} />
            <span className="p3-avatar-editbadge"><Camera size={14} /></span>
          </button>
          {entry.avatar && <button className="p3-link" onClick={() => setWalletAvatar(entry.id, null)}>Remove photo</button>}

          {editing ? (
            <div className="p3-nameedit">
              <input className="p3-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} autoFocus onKeyDown={(e) => e.key === "Enter" && saveName()} />
              <button className="p3-btn primary sm" onClick={saveName}><Check size={16} /></button>
            </div>
          ) : (
            <button className="p3-namerow" onClick={() => { setDraft(entry.name); setEditing(true); }}>
              <h3>{entry.name}</h3>
              <Pencil size={15} />
            </button>
          )}
          <span className="p3-tag">{WALLET_KINDS[entry.kind].label}</span>
        </div>

        <div className="p3-group first">Addresses</div>
        <div className="p3-menu list">
          {entry.evmAddress && (
            <div className="p3-menuitem static">
              <span className="grow"><span className="t">EVM · 8 networks</span><span className="s mono">{short(entry.evmAddress, 10, 8)}</span></span>
              <button className="p3-iconlink" onClick={() => copyText(entry.evmAddress, "Address copied")} aria-label="Copy EVM address"><Copy size={16} /></button>
              <a className="p3-iconlink" href={CHAINS.ethereum.explorerAddr(entry.evmAddress)} target="_blank" rel="noopener noreferrer" aria-label="View on Etherscan"><ExternalLink size={16} /></a>
            </div>
          )}
          {entry.solAddress && (
            <div className="p3-menuitem static">
              <span className="grow"><span className="t">Solana</span><span className="s mono">{short(entry.solAddress, 10, 8)}</span></span>
              <button className="p3-iconlink" onClick={() => copyText(entry.solAddress, "Address copied")} aria-label="Copy Solana address"><Copy size={16} /></button>
              <a className="p3-iconlink" href={CHAINS.solana.explorerAddr(entry.solAddress)} target="_blank" rel="noopener noreferrer" aria-label="View on Solana Explorer"><ExternalLink size={16} /></a>
            </div>
          )}
        </div>

        <div className="p3-group">Security</div>
        <div className="p3-menu list">
          <button className="p3-menuitem" onClick={() => setBackupOpen(true)}>
            <span className="p3-menuicon"><ShieldCheck size={19} /></span>
            <span className="grow"><span className="t">Back up wallet</span><span className="s">Show recovery phrase / private key</span></span>
          </button>
          {entry.kind === "phrase" && (
            <button className="p3-menuitem" onClick={addAccount} disabled={addingAccount}>
              <span className="p3-menuicon">{addingAccount ? <Spinner size={18} /> : <Plus size={19} />}</span>
              <span className="grow"><span className="t">Add another account</span><span className="s">Derive the next account from this phrase</span></span>
            </button>
          )}
          <button className="p3-menuitem danger" onClick={() => setRemoveOpen(true)}>
            <span className="p3-menuicon danger"><Trash2 size={19} /></span>
            <span className="grow"><span className="t">Remove wallet from device</span></span>
          </button>
        </div>
      </div>

      {backupOpen && <BackupSheet entry={entry} onClose={() => setBackupOpen(false)} />}
      {removeOpen && (
        <Sheet title={`Remove ${entry.name}?`} onClose={() => setRemoveOpen(false)}>
          <p className="p3-help" style={{ marginBottom: 20 }}>
            {wallets.length <= 1 ? "This is your only wallet, so Pay3 will go back to the welcome screen. " : ""}
            This deletes the encrypted wallet from this device. Without its recovery phrase or private key, any funds in it will be permanently unreachable. This cannot be undone.
          </p>
          <div className="p3-rowbtns">
            <button className="p3-btn outline" onClick={() => setRemoveOpen(false)}>Cancel</button>
            <button className="p3-btn danger" onClick={() => removeWallet(entry.id)}>Remove</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function BackupSheet({ entry, onClose }) {
  const { decryptForBackup, copyText } = useApp();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const unlock = async () => {
    setBusy(true);
    setError("");
    try {
      const { keys } = await decryptForBackup(entry.id, password);
      setSecret(secretForBackup(entry, keys));
    } catch {
      setError("Incorrect password.");
    }
    setBusy(false);
  };

  const download = () => {
    const blob = new Blob([entry.keystore], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pay3-backup-${entry.name.replace(/\W+/g, "-").toLowerCase()}-${short(entry.evmAddress || entry.solAddress, 6, 4)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet title="Back up wallet" onClose={onClose}>
      {!secret ? (
        <>
          <p className="p3-help" style={{ marginBottom: 16 }}>Enter your password to view the secret for <strong>{entry.name}</strong>.</p>
          <div className="p3-field">
            <label>Password</label>
            <input className="p3-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && password && unlock()} autoFocus />
          </div>
          <ErrorLine>{error}</ErrorLine>
          <button className="p3-btn primary" disabled={busy || !password} onClick={unlock}>{busy ? <Spinner /> : "Continue"}</button>
        </>
      ) : (
        <>
          <Warn>Never share this with anyone. Anyone who sees it can take everything in this wallet.</Warn>
          <div className="p3-mnemonic-box">
            {secret.words ? (
              <div className={`p3-mnemonic-grid ${revealed ? "revealed" : ""}`}>
                {secret.words.map((w, i) => (
                  <div className="p3-mnemonic-word" key={i}><span className="idx">{i + 1}</span>{w}</div>
                ))}
              </div>
            ) : (
              <div className={`p3-mnemonic-grid single ${revealed ? "revealed" : ""}`}>
                <div className="p3-mnemonic-word breakall">{secret.text}</div>
              </div>
            )}
            {!revealed && (
              <div className="p3-reveal-overlay" onClick={() => setRevealed(true)}><Eye size={16} /> Tap to reveal {secret.label.toLowerCase()}</div>
            )}
          </div>
          {revealed && (
            <button className="p3-btn ghost sm" style={{ margin: "10px auto 0" }} onClick={() => copyText(secret.text, `${secret.label} copied`)}>
              <Copy size={14} /> Copy
            </button>
          )}
          {entry.evmAddress && entry.kind !== "solkey" && (
            <button className="p3-btn soft" style={{ marginTop: 16 }} onClick={download}><FileDown size={16} /> Download encrypted backup file</button>
          )}
          <button className="p3-btn outline" style={{ marginTop: 10 }} onClick={onClose}>Done</button>
        </>
      )}
    </Sheet>
  );
}

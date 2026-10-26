"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { ClipboardPaste, Link2, ScanLine } from "lucide-react";
import { useApp } from "../AppProvider";
import { Sheet, Spinner, Warn, ErrorLine } from "../ui";
import ScannerOverlay from "../Scanner";
import { CHAINS, WC_METHOD_LABELS, chainKeyFromCaip } from "../../lib/chains";
import { short } from "../../lib/format";

export function ConnectSheet() {
  const { closeSheet, pairUri } = useApp();
  const [uri, setUri] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const paste = async () => {
    try {
      setUri(await navigator.clipboard.readText());
    } catch {
      /* clipboard read can be blocked; the user can still paste manually */
    }
  };
  const go = (value) => {
    pairUri(value);
    closeSheet();
  };

  return (
    <>
      <Sheet title="Connect to a site" onClose={closeSheet}>
        <p className="p3-help" style={{ marginBottom: 16 }}>
          On the site you want to connect to, choose WalletConnect and copy its connection link, or scan its QR code.
        </p>
        <button className="p3-btn soft" style={{ marginBottom: 14 }} onClick={() => setScannerOpen(true)}>
          <ScanLine size={18} /> Scan QR code
        </button>
        <div className="p3-field">
          <label>Or paste a connection link</label>
          <div className="p3-inputwrap">
            <input className="p3-input" value={uri} onChange={(e) => setUri(e.target.value)} placeholder="wc:…" style={{ paddingRight: 48 }} />
            <button className="p3-inputbtn" onClick={paste} aria-label="Paste" type="button">
              <ClipboardPaste size={16} />
            </button>
          </div>
        </div>
        <button className="p3-btn primary" disabled={!uri.trim()} onClick={() => go(uri)}>
          Connect
        </button>
      </Sheet>
      {scannerOpen && (
        <ScannerOverlay
          title="Scan WalletConnect QR code"
          validate={(t) => (t && t.trim().toLowerCase().startsWith("wc:") ? t.trim() : null)}
          onResult={(v) => {
            setScannerOpen(false);
            go(v);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  );
}

function AppIcon({ src, size }) {
  return src ? (
    <img src={src} alt="" className="p3-appicon" style={{ width: size, height: size }} />
  ) : (
    <div className="p3-chain-mono" style={{ width: size, height: size, borderRadius: 12 }}>
      <Link2 size={size * 0.4} />
    </div>
  );
}

export function SessionProposalModal() {
  const { pendingProposal: proposal, approveProposal, rejectProposal, activeEntry } = useApp();
  const [busy, setBusy] = useState(false);
  const meta = proposal?.params?.proposer?.metadata || {};
  const requested = [...Object.values(proposal?.params?.requiredNamespaces || {}), ...Object.values(proposal?.params?.optionalNamespaces || {})].flatMap((ns) => ns.chains || []);
  const anySupported = requested.some((c) => chainKeyFromCaip(c));

  return (
    <div className="p3-overlay">
      <div className="p3-sheet">
        <div className="p3-sheet-head"><h3>Connection request</h3></div>
        <div className="p3-appline">
          <AppIcon src={meta.icons?.[0]} size={46} />
          <div>
            <div className="n">{meta.name || "Unknown app"}</div>
            <div className="s">{meta.url}</div>
          </div>
        </div>
        {!activeEntry?.evmAddress && <ErrorLine>This wallet has no EVM address. Switch to a wallet that does, then reconnect.</ErrorLine>}
        {!anySupported && <Warn>This app may be asking for a network Pay3 doesn't support. You can still try to connect.</Warn>}
        <p className="p3-help" style={{ marginBottom: 18 }}>
          This lets <strong>{meta.name || "this site"}</strong> see the address of <strong>{activeEntry?.name}</strong> and ask you to approve transactions and signatures. It can't move funds without your approval on each request.
        </p>
        <div className="p3-rowbtns">
          <button className="p3-btn outline" disabled={busy} onClick={rejectProposal}>Reject</button>
          <button
            className="p3-btn primary"
            disabled={busy || !activeEntry?.evmAddress}
            onClick={async () => {
              setBusy(true);
              await approveProposal();
              setBusy(false);
            }}
          >
            {busy ? <Spinner /> : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SessionRequestModal() {
  const { pendingRequest: event, walletKit, approveRequest, rejectRequest, wallets, sessionWallet } = useApp();
  const [busy, setBusy] = useState(false);
  const { topic, params } = event;
  const { request, chainId } = params;
  const session = walletKit?.getActiveSessions ? walletKit.getActiveSessions()[topic] : null;
  const meta = session?.peer?.metadata || {};
  const chainKey = chainKeyFromCaip(chainId);
  const chainDef = chainKey ? CHAINS[chainKey] : null;
  const walletName = wallets.find((w) => w.id === sessionWallet(topic))?.name;
  const supported = Object.keys(WC_METHOD_LABELS).includes(request.method);

  const details = () => {
    if (request.method === "personal_sign") {
      let text;
      try {
        text = ethers.toUtf8String(request.params[0]);
      } catch {
        text = request.params[0];
      }
      return <div className="p3-addr-box scroll">{text}</div>;
    }
    if (request.method === "eth_sendTransaction" || request.method === "eth_signTransaction") {
      const tx = request.params[0] || {};
      return (
        <div className="p3-summary">
          <div className="row"><span className="k">To</span><span>{short(tx.to)}</span></div>
          <div className="row"><span className="k">Value</span><span>{tx.value ? `${ethers.formatEther(BigInt(tx.value))} ${chainDef?.symbol || ""}` : "0"}</span></div>
          <div className="row"><span className="k">Data</span><span>{tx.data && tx.data !== "0x" ? "Contract interaction" : "None"}</span></div>
        </div>
      );
    }
    if (request.method === "eth_signTypedData" || request.method === "eth_signTypedData_v4") {
      const raw = request.params[1];
      return <pre className="p3-addr-box scroll small">{typeof raw === "string" ? raw : JSON.stringify(raw, null, 2)}</pre>;
    }
    return <p className="p3-help">Pay3 doesn't support this request type yet.</p>;
  };

  return (
    <div className="p3-overlay">
      <div className="p3-sheet">
        <div className="p3-sheet-head"><h3>{WC_METHOD_LABELS[request.method] || request.method}</h3></div>
        <div className="p3-appline">
          <AppIcon src={meta.icons?.[0]} size={38} />
          <div>
            <div className="n">{meta.name || "Connected app"}</div>
            <div className="s">{chainDef?.name || "Unknown network"}{walletName ? ` · ${walletName}` : ""}</div>
          </div>
        </div>
        {details()}
        {!supported && <ErrorLine>Pay3 can't fulfil this request — you can only reject it.</ErrorLine>}
        <div className="p3-rowbtns" style={{ marginTop: 18 }}>
          <button className="p3-btn outline" disabled={busy} onClick={rejectRequest}>Reject</button>
          <button
            className="p3-btn primary"
            disabled={busy || !supported}
            onClick={async () => {
              setBusy(true);
              await approveRequest();
              setBusy(false);
            }}
          >
            {busy ? <Spinner /> : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

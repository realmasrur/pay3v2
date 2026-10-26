"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { Check, ChevronDown, ClipboardPaste, Copy, ExternalLink, Gauge, Leaf, ScanLine, X, Zap } from "lucide-react";
import { useApp } from "../AppProvider";
import { CoinLogo, ErrorLine, Header, Spinner } from "../ui";
import ScannerOverlay from "../Scanner";
import { AssetPickerSheet } from "../sheets/CoinSheets";
import { CHAINS } from "../../lib/chains";
import { computeFee, feeOverrides, NATIVE_TRANSFER_GAS, SOL_ATA_RENT, SOL_BASE_FEE, SPEED } from "../../lib/fees";
import { estimateEvmTokenGas, FALLBACK_TOKEN_GAS, sendEvmToken, sendSolanaToken, solRecipientNeedsAccount } from "../../lib/tokens";
import { extractAddress, isValidAddressFor } from "../../lib/address";
import { formatAmount, formatFiat, short } from "../../lib/format";

const SPEED_ICONS = { eco: Leaf, standard: Gauge, fast: Zap };

export default function SendScreen({ params }) {
  const { allAssets, prefs, back, goTab, getSigner, getEvmProvider, getSolanaConnection, refreshBalances, showToast, copyText } = useApp();

  const initial = useMemo(() => {
    if (params?.assetId) {
      const found = allAssets.find((a) => a.id === params.assetId);
      if (found) return found;
    }
    return [...allAssets].filter((a) => !a.hidden).sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || b.balance - a.balance)[0] || allAssets[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [assetKey, setAssetKey] = useState(initial?.id);
  const asset = allAssets.find((a) => a.id === assetKey) || initial;
  const chain = CHAINS[asset.chain];
  const isEvm = chain.type === "evm";

  const [step, setStep] = useState("form");
  const [to, setTo] = useState(params?.to || "");
  const [amount, setAmount] = useState("");
  const [speed, setSpeed] = useState("standard");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [feeData, setFeeData] = useState(null);
  const [tokenGas, setTokenGas] = useState(null);
  const [needsAccount, setNeedsAccount] = useState(false);

  const nativeRow = allAssets.find((a) => a.native && a.chain === asset.chain);
  const nativeBal = nativeRow?.balance || 0;
  const toValid = to === "" ? null : isValidAddressFor(chain, to.trim());
  const amountNum = parseFloat(amount || "0");
  const decimalsOk = !amount.includes(".") || amount.split(".")[1].length <= asset.decimals;

  /* network fee data for the asset's chain */
  useEffect(() => {
    setFeeData(null);
    if (!isEvm) return undefined;
    let cancelled = false;
    getEvmProvider(asset.chain).getFeeData().then((d) => !cancelled && setFeeData(d)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [asset.chain, isEvm, getEvmProvider]);

  /* gas estimate for ERC-20 transfers; account-rent check for SPL transfers */
  useEffect(() => {
    setTokenGas(null);
    setNeedsAccount(false);
    if (asset.native || !toValid || !(amountNum > 0) || !decimalsOk) return undefined;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (isEvm) {
        const from = getSigner(asset.chain)?.address;
        const gas = await estimateEvmTokenGas({ provider: getEvmProvider(asset.chain), asset, from, to: to.trim(), amount });
        if (!cancelled) setTokenGas(gas);
      } else {
        const needs = await solRecipientNeedsAccount({ connection: getSolanaConnection(), asset, to: to.trim() });
        if (!cancelled) setNeedsAccount(needs);
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id, to, amount, toValid]);

  const gasLimit = asset.native ? NATIVE_TRANSFER_GAS : tokenGas ?? FALLBACK_TOKEN_GAS;
  const fee = isEvm ? computeFee(feeData, speed, gasLimit) : null;
  const feeNative = isEvm ? (fee ? parseFloat(ethers.formatEther(fee.totalWei)) : null) : SOL_BASE_FEE + (needsAccount ? SOL_ATA_RENT : 0);
  const feeNum = feeNative ?? 0;

  const needed = asset.native ? amountNum + feeNum : amountNum;
  const enoughAsset = needed <= asset.balance;
  const enoughGas = asset.native || feeNum <= nativeBal;
  const canReview = toValid && amountNum > 0 && decimalsOk && enoughAsset && enoughGas && (!isEvm || fee);

  const fiat = asset.price != null && amountNum > 0 ? formatFiat(amountNum * asset.price, prefs.currency) : null;

  const handleMax = () => {
    if (asset.native) {
      const cushion = isEvm ? (feeNative ?? 0) * 1.05 : SOL_BASE_FEE * 1.5;
      setAmount(Math.max(0, asset.balance - cushion).toFixed(Math.min(asset.decimals, 8)).replace(/\.?0+$/, "") || "0");
    } else {
      setAmount(asset.rawBalance || "0");
    }
  };

  const review = () => {
    setError("");
    if (!toValid) return setError(`Enter a valid ${chain.name} address.`);
    if (!(amountNum > 0)) return setError("Enter an amount greater than 0.");
    if (!decimalsOk) return setError(`${asset.symbol} supports up to ${asset.decimals} decimal places.`);
    if (!enoughAsset) return setError(asset.native ? "Amount plus network fee exceeds your balance." : `Not enough ${asset.symbol}.`);
    if (!enoughGas) return setError(`You need a little ${chain.symbol} on ${chain.name} to pay the network fee.`);
    setStep("review");
  };

  const confirm = async () => {
    setStep("pending");
    setError("");
    const dest = to.trim();
    try {
      if (isEvm) {
        const signer = getSigner(asset.chain);
        const overrides = feeOverrides(fee);
        const tx = asset.native
          ? await signer.sendTransaction({ to: dest, value: ethers.parseEther(amount), ...overrides })
          : await sendEvmToken({ signer, asset, to: dest, amount, overrides });
        setTxHash(tx.hash);
        await tx.wait();
      } else {
        const keypair = getSigner("solana");
        const connection = getSolanaConnection();
        if (asset.native) {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          const tx = new Transaction({ feePayer: keypair.publicKey, recentBlockhash: blockhash }).add(
            SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: new PublicKey(dest), lamports: Math.round(amountNum * 1e9) })
          );
          tx.sign(keypair);
          const sig = await connection.sendRawTransaction(tx.serialize());
          setTxHash(sig);
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        } else {
          const sig = await sendSolanaToken({ connection, keypair, asset, to: dest, amount });
          setTxHash(sig);
        }
      }
      setStep("success");
      refreshBalances(true);
    } catch (e) {
      setError(e?.shortMessage || e?.reason || e?.message || "Transaction failed. Please try again.");
      setStep("error");
    }
  };

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      setTo(extractAddress(text, chain) || text);
    } catch {
      showToast("error", "Couldn't read the clipboard");
    }
  };

  /* ---------------- status steps ---------------- */
  if (step === "pending") {
    return (
      <div className="p3-status-panel">
        <div className="p3-status-icon pending"><Spinner size={28} /></div>
        <h3>Broadcasting transaction</h3>
        <p>Sending {amount} {asset.symbol} to {short(to.trim())}. This can take a few moments to confirm.</p>
      </div>
    );
  }
  if (step === "success") {
    return (
      <div className="p3-status-panel">
        <div className="p3-status-icon success"><Check size={28} /></div>
        <h3>Transaction sent</h3>
        <p>{amount} {asset.symbol} is on its way to {short(to.trim())}.</p>
        <div className="p3-hashrow">
          {short(txHash)}
          <button onClick={() => copyText(txHash, "Hash copied")} aria-label="Copy hash"><Copy size={14} /></button>
          <a href={chain.explorerTx(txHash)} target="_blank" rel="noopener noreferrer" aria-label="View on explorer"><ExternalLink size={14} /></a>
        </div>
        <button className="p3-btn primary" onClick={() => goTab("home")}>Done</button>
      </div>
    );
  }
  if (step === "error") {
    return (
      <div className="p3-status-panel">
        <div className="p3-status-icon error"><X size={28} /></div>
        <h3>Transaction failed</h3>
        <p>{error}</p>
        <button className="p3-btn soft" onClick={() => setStep("form")}>Try again</button>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div>
        <Header title="Review transfer" onBack={() => setStep("form")} />
        <div className="p3-pad">
          <div className="p3-reviewhero">
            <CoinLogo asset={asset} size={60} />
            <div className="amt">{amount} <span>{asset.symbol}</span></div>
            {fiat && <div className="fiat">≈ {fiat}</div>}
          </div>
          <div className="p3-summary">
            <div className="row"><span className="k">To</span><span>{short(to.trim(), 8, 6)}</span></div>
            <div className="row"><span className="k">Network</span><span>{chain.name}</span></div>
            <div className="row"><span className="k">Network fee{isEvm ? ` (${SPEED[speed].label})` : ""}</span><span>{feeNative != null ? `${feeNative.toFixed(6)} ${chain.symbol}` : "—"}</span></div>
            {asset.native && <div className="row total"><span className="k">Total</span><span>{(amountNum + feeNum).toFixed(6)} {chain.symbol}</span></div>}
          </div>
          <ErrorLine>{error}</ErrorLine>
          <div className="p3-rowbtns">
            <button className="p3-btn outline" onClick={() => setStep("form")}>Edit</button>
            <button className="p3-btn primary" onClick={confirm}>Confirm &amp; send</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- form ---------------- */
  return (
    <div>
      <Header title={`Send ${asset.symbol}`} onBack={back} />
      <div className="p3-pad">
        <button className="p3-assetpick" onClick={() => setPickerOpen(true)}>
          <CoinLogo asset={asset} size={42} />
          <span className="mid">
            <span className="n">{asset.name}</span>
            <span className="s">{formatAmount(asset.balance, 8)} {asset.symbol} on {chain.name}</span>
          </span>
          <ChevronDown size={18} />
        </button>

        <div className="p3-field">
          <label>Recipient address</label>
          <div className="p3-inputwrap">
            <input
              className={`p3-input mono ${toValid === false ? "bad" : ""}`}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={chain.type === "solana" ? "Base58 address…" : "0x…"}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              style={{ paddingRight: 92 }}
            />
            <span className="p3-inputbtns">
              <button onClick={paste} aria-label="Paste" type="button"><ClipboardPaste size={16} /></button>
              <button onClick={() => setScannerOpen(true)} aria-label="Scan QR code" type="button"><ScanLine size={17} /></button>
            </span>
          </div>
          {toValid === false && <p className="p3-help bad">That isn't a valid {chain.name} address.</p>}
        </div>

        <div className="p3-field">
          <label>Amount ({asset.symbol})</label>
          <div className="p3-inputwrap">
            <input className="p3-input" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} placeholder="0.00" inputMode="decimal" style={{ paddingRight: 70 }} />
            <button className="p3-maxbtn" onClick={handleMax} type="button">MAX</button>
          </div>
          <p className="p3-help" style={{ marginTop: 6 }}>
            Available: {formatAmount(asset.balance, 8)} {asset.symbol}{fiat ? ` · ≈ ${fiat}` : ""}
          </p>
        </div>

        {isEvm ? (
          <div className="p3-field">
            <label>Network fee — gas speed</label>
            <div className="p3-speedrow">
              {Object.entries(SPEED).map(([key, s]) => {
                const Icon = SPEED_ICONS[key];
                const f = computeFee(feeData, key, gasLimit);
                return (
                  <button key={key} className={`p3-speedopt ${speed === key ? "active" : ""}`} onClick={() => setSpeed(key)}>
                    <Icon size={17} />
                    <span className="lbl">{s.label}</span>
                    <span className="fee">{f ? `${parseFloat(ethers.formatEther(f.totalWei)).toFixed(5)} ${chain.symbol}` : "…"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="p3-help" style={{ marginBottom: 16 }}>
            Network fee: ~{(SOL_BASE_FEE + (needsAccount ? SOL_ATA_RENT : 0)).toFixed(6)} SOL.
            {needsAccount && " The recipient has no account for this token yet, so a small one-time rent (~0.002 SOL) is included to create it."}
          </p>
        )}

        <ErrorLine>{error}</ErrorLine>
        <button className="p3-btn primary" disabled={!canReview} onClick={review}>Review transfer</button>
        {!asset.native && !enoughGas && amountNum > 0 && <p className="p3-help bad center" style={{ marginTop: 10 }}>You need some {chain.symbol} on {chain.name} to pay the fee.</p>}
      </div>

      {pickerOpen && (
        <AssetPickerSheet
          selectedId={asset.id}
          onClose={() => setPickerOpen(false)}
          onPick={(a) => {
            setAssetKey(a.id);
            setAmount("");
            setPickerOpen(false);
          }}
        />
      )}
      {scannerOpen && (
        <ScannerOverlay
          title={`Scan ${chain.name} address`}
          validate={(text) => extractAddress(text, chain)}
          onResult={(addr) => {
            setTo(addr);
            setScannerOpen(false);
            showToast("success", "Address scanned");
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}

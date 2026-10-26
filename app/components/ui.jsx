"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, X, Loader2, Check, ShieldAlert } from "lucide-react";
import { CHAINS } from "../lib/chains";
import { assetLogoCandidates, chainLogoCandidates } from "../lib/logos";
import { hashString, mulberry32 } from "../lib/format";

/* ------------------------------------------------------------------ */
/*  Wallet avatar — photo if set, otherwise a deterministic pixel      */
/*  pattern generated from the address (same wallet → same avatar).    */
/* ------------------------------------------------------------------ */

const AVATAR_BG = ["#F7B4EE", "#FFB566", "#8FEFC9", "#B7A9FF", "#FFD86B", "#86D6FF", "#FF9DA8"];
const AVATAR_FG = ["#12DFF5", "#2F6BFF", "#FF4FA3", "#171B26", "#FFFFFF", "#7A4DFF"];

function avatarCells(seed) {
  const rnd = mulberry32(hashString(seed));
  const bg = AVATAR_BG[Math.floor(rnd() * AVATAR_BG.length)];
  const fgA = AVATAR_FG[Math.floor(rnd() * AVATAR_FG.length)];
  const fgB = AVATAR_FG[Math.floor(rnd() * AVATAR_FG.length)];
  const cells = [];
  const N = 8;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (rnd() < 0.34) cells.push({ x, y, w: rnd() < 0.3 ? 2 : 1, fill: rnd() < 0.7 ? fgA : fgB });
    }
  }
  return { bg, cells, N };
}

export function Avatar({ entry, seed, src, size = 40, className = "" }) {
  const key = seed || entry?.evmAddress || entry?.solAddress || entry?.id || "pay3";
  const photo = src ?? entry?.avatar;
  const { bg, cells, N } = useMemo(() => avatarCells(key), [key]);
  const style = { width: size, height: size };
  if (photo) return <img className={`p3-avatar ${className}`} style={style} src={photo} alt="" />;
  return (
    <svg className={`p3-avatar ${className}`} style={style} viewBox={`0 0 ${N} ${N}`} aria-hidden="true">
      <rect width={N} height={N} fill={bg} />
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={Math.min(c.w, N - c.x)} height={1} fill={c.fill} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Coin logo — walks a list of GitHub-hosted candidates, then falls   */
/*  back to a coloured letter badge.                                    */
/* ------------------------------------------------------------------ */

function useImageChain(candidates) {
  const key = candidates.join("|");
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [key]);
  return { src: candidates[i], failed: i >= candidates.length, next: () => setI((n) => n + 1) };
}

export function ChainBadge({ chain, size = 16 }) {
  const cands = useMemo(() => chainLogoCandidates(chain), [chain]);
  const { src, failed, next } = useImageChain(cands);
  const def = CHAINS[chain];
  return (
    <span className="p3-chainbadge" style={{ width: size, height: size, background: def.color }}>
      {!failed && <img src={src} alt="" onError={next} referrerPolicy="no-referrer" loading="lazy" />}
    </span>
  );
}

export function CoinLogo({ asset, size = 44, badge = true, corner = null }) {
  const cands = useMemo(
    () => assetLogoCandidates(asset),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asset.chain, asset.address, asset.logo, asset.verified, asset.symbol]
  );
  const { src, failed, next } = useImageChain(cands);
  const def = CHAINS[asset.chain];
  return (
    <span className="p3-coin" style={{ width: size, height: size }}>
      {failed ? (
        <span className="p3-coin-letter" style={{ background: def.color, fontSize: size * 0.42 }}>
          {(asset.symbol || "?").slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <img src={src} alt="" onError={next} referrerPolicy="no-referrer" loading="lazy" />
      )}
      {corner ? <span className="p3-coin-corner">{corner}</span> : badge ? <span className="p3-coin-corner"><ChainBadge chain={asset.chain} size={Math.round(size * 0.42)} /></span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Layout primitives                                                  */
/* ------------------------------------------------------------------ */

export function Header({ title, onBack, right }) {
  return (
    <div className="p3-header">
      {onBack ? (
        <button className="p3-backbtn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
      ) : (
        <span className="p3-header-spacer" />
      )}
      <h2>{title}</h2>
      <div className="p3-header-right">{right}</div>
    </div>
  );
}

export function Sheet({ title, onClose, children, tall = false, noHead = false }) {
  return (
    <div className="p3-overlay" onClick={onClose}>
      <div className={`p3-sheet ${tall ? "tall" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        {!noHead && (
          <div className="p3-sheet-head">
            <h3>{title}</h3>
            <button className="p3-roundbtn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Spinner({ size = 18 }) {
  return <Loader2 size={size} className="p3-spin" />;
}

export function Empty({ icon: Icon, children }) {
  return (
    <div className="p3-empty">
      <div className="ic">{Icon && <Icon size={20} />}</div>
      <p>{children}</p>
    </div>
  );
}

export function ErrorLine({ children }) {
  if (!children) return null;
  return (
    <div className="p3-error">
      <ShieldAlert size={14} style={{ flexShrink: 0 }} /> <span>{children}</span>
    </div>
  );
}

export function Warn({ children }) {
  return (
    <div className="p3-warnbanner">
      <ShieldAlert size={16} style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`p3-toast ${toast.type}`} role="status">
      {toast.type === "success" ? <Check size={15} /> : <ShieldAlert size={15} />}
      <span>{toast.message}</span>
    </div>
  );
}

/** Horizontal network selector. `chains` = keys; `all` adds an "All networks" chip. */
export function NetworkChips({ chains, value, onChange, all = false }) {
  return (
    <div className="p3-chips">
      {all && (
        <button className={`p3-chip ${value === "all" ? "active" : ""}`} onClick={() => onChange("all")}>
          All
        </button>
      )}
      {chains.map((k) => (
        <button key={k} className={`p3-chip ${value === k ? "active" : ""}`} onClick={() => onChange(k)}>
          <ChainBadge chain={k} size={16} /> {CHAINS[k].name}
        </button>
      ))}
    </div>
  );
}

export function PasswordInput({ value, onChange, placeholder, onEnter, autoFocus, show, onToggle }) {
  return (
    <div className="p3-passrow">
      <input
        className="p3-input"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {onToggle && (
        <button className="p3-eye" type="button" onClick={onToggle} aria-label={show ? "Hide password" : "Show password"}>
          {show ? "Hide" : "Show"}
        </button>
      )}
    </div>
  );
}

export function BrandMark({ size = 30 }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="p3-brand-mark" style={{ width: size, height: size }}>P3</div>;
  return <img src="/logo.png" alt="Pay3" className="p3-brand-mark-img" style={{ width: size, height: size }} onError={() => setFailed(true)} />;
}

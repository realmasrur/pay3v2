"use client";

import { TriangleDown, TriangleUp } from "./icons";
import { CoinLogo } from "./ui";
import { formatAmount, formatFiat, formatPct } from "../lib/format";

/** One coin line: logo + network badge, name, amount — fiat value + 24h change on the right. */
export default function AssetRow({ asset, currency, hide = false, onClick, trailing = null, showChange = true }) {
  const up = (asset.change ?? 0) >= 0;
  return (
    <div className={`p3-assetrow ${onClick ? "clickable" : ""}`} onClick={onClick} role={onClick ? "button" : undefined}>
      <CoinLogo asset={asset} size={46} />
      <div className="mid">
        <div className="n">
          {asset.name}
          {asset.custom && !asset.verified && <span className="p3-tag">Custom</span>}
        </div>
        <div className="s">{hide ? "••••" : `${formatAmount(asset.balance)} ${asset.symbol}`}</div>
      </div>
      {trailing || (
        <div className="right">
          <div className="n">{hide ? "••••" : asset.value == null ? "—" : formatFiat(asset.value, currency)}</div>
          {showChange && asset.change != null && (
            <div className={`s ${up ? "up" : "down"}`}>
              {up ? <TriangleUp /> : <TriangleDown />} {formatPct(asset.change)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

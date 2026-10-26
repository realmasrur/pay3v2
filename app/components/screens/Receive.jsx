"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { useApp } from "../AppProvider";
import { Header, NetworkChips } from "../ui";
import { CHAINS, addressOnChain } from "../../lib/chains";

export default function ReceiveScreen({ params }) {
  const { activeEntry, walletChains, networkFilter, back, copyText } = useApp();
  const start = params?.chain && walletChains.includes(params.chain) ? params.chain : networkFilter !== "all" && walletChains.includes(networkFilter) ? networkFilter : walletChains[0];
  const [chainKey, setChainKey] = useState(start);
  const chain = CHAINS[chainKey];
  const address = addressOnChain(activeEntry, chainKey);

  const qrRef = useRef(null);
  const qrInstance = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!qrRef.current || !address) return;
      const { default: QRCodeStyling } = await import("qr-code-styling");
      if (cancelled || !qrRef.current) return;
      if (!qrInstance.current) {
        qrInstance.current = new QRCodeStyling({
          width: 232,
          height: 232,
          type: "svg",
          data: address,
          margin: 6,
          qrOptions: { errorCorrectionLevel: "H" },
          dotsOptions: { type: "rounded", color: "#0A0E17" },
          cornersSquareOptions: { type: "extra-rounded", color: "#0A0E17" },
          cornersDotOptions: { type: "dot", color: "#00B8D9" },
          backgroundOptions: { color: "#ffffff" },
          image: "/logo.png",
          imageOptions: { imageSize: 0.32, margin: 4, hideBackgroundDots: true },
        });
        qrRef.current.innerHTML = "";
        qrInstance.current.append(qrRef.current);
      } else {
        qrInstance.current.update({ data: address });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const share = async () => {
    try {
      await navigator.share({ title: `${activeEntry.name} · ${chain.name}`, text: address });
    } catch {
      /* cancelled or unsupported */
    }
  };

  return (
    <div>
      <Header title="Receive" onBack={back} />
      <div className="p3-pad">
        <NetworkChips chains={walletChains} value={chainKey} onChange={setChainKey} />

        <div className="p3-receive">
          <div className="p3-qr" ref={qrRef} />
          <div className="p3-recv-name">{activeEntry.name} · {chain.name}</div>
          <div className="p3-addr-box">{address}</div>
          <div className="p3-rowbtns">
            <button className="p3-btn primary" onClick={() => copyText(address, "Address copied")}>
              <Copy size={16} /> Copy
            </button>
            {typeof navigator !== "undefined" && navigator.share && (
              <button className="p3-btn soft" onClick={share}>
                <Share2 size={16} /> Share
              </button>
            )}
          </div>
        </div>

        <p className="p3-help center">
          {chain.type === "evm"
            ? `This address works on all 8 EVM networks. Only send ${chain.symbol} or tokens on ${chain.name} here — assets sent on a different network may be lost.`
            : "Only send SOL or SPL tokens on Solana to this address."}
        </p>
      </div>
    </div>
  );
}

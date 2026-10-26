"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/** Full-screen camera QR scanner. `validate(text)` returns a value to accept the code, or null to keep scanning. */
export default function ScannerOverlay({ title, validate, onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream = null;
    let rafId = null;
    let stopped = false;
    let jsQRfn = null;

    async function start() {
      try {
        const mod = await import("jsqr");
        jsQRfn = mod.default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        setError("Camera access denied or unavailable. Close this and paste instead.");
      }
    }

    function tick() {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQRfn ? jsQRfn(img.data, img.width, img.height) : null;
        if (code?.data) {
          const extracted = validate(code.data);
          if (extracted) {
            stopped = true;
            if (stream) stream.getTracks().forEach((t) => t.stop());
            onResult(extracted);
            return;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    start();
    return () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p3-scanner-overlay">
      <video ref={videoRef} className="p3-scanner-video" muted playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="p3-scanner-guide" />
      <div className="p3-scanner-top">
        <div className="p3-scanner-title">{title}</div>
        <button className="p3-roundbtn" onClick={onClose} aria-label="Close scanner">
          <X size={18} />
        </button>
      </div>
      <div className="p3-scanner-bottom">{error || "Point your camera at a QR code"}</div>
    </div>
  );
}

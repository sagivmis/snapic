import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import "../styles/GuestQrCode.scss";

interface GuestQrCodeProps {
  url: string;
  label?: string;
}

export function GuestQrCode({ url, label = "Guest link QR code" }: GuestQrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) {
      return;
    }
    void QRCode.toCanvas(canvas, url, {
      width: 240,
      margin: 2,
      color: { dark: "#3d3832", light: "#ffffff" },
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not generate QR code");
    });
  }, [url]);

  async function downloadPng() {
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = "snapic-guest-qr.png";
      anchor.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }

  return (
    <div className="guest-qr">
      <canvas ref={canvasRef} className="guest-qr__canvas" aria-label={label} role="img" />
      <button type="button" className="btn btn-secondary guest-qr__download" onClick={() => void downloadPng()}>
        Download PNG
      </button>
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}

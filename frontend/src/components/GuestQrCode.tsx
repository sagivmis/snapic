import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import "../styles/GuestQrCode.scss";

interface GuestQrCodeProps {
  url: string;
  label?: string;
  eventTitle?: string;
  coupleNames?: string | null;
}

function displayTitle(coupleNames?: string | null, eventTitle?: string): string {
  if (coupleNames?.trim()) {
    return coupleNames.trim();
  }
  if (eventTitle?.trim()) {
    return eventTitle.trim();
  }
  return "Find your photos";
}

async function drawPrintableCard(
  url: string,
  heading: string,
): Promise<string> {
  const width = 800;
  const height = 1040;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create printable card");
  }

  ctx.fillStyle = "#fdfbf7";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#c9a87c";
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, width - 96, height - 96);

  ctx.fillStyle = "#3a322b";
  ctx.font = "600 44px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.fillText(heading, width / 2, 130, width - 120);

  ctx.font = "22px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "#6b5e52";
  ctx.fillText("Scan to find your wedding photos", width / 2, 190);

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
    width: 400,
    margin: 2,
    color: { dark: "#3a322b", light: "#ffffff" },
  });
  ctx.drawImage(qrCanvas, (width - 400) / 2, 240, 400, 400);

  ctx.font = "20px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "#6b5e52";
  const steps = [
    "1. Open your camera and scan the code",
    "2. Upload a clear selfie of your face",
    "3. View and download your photos",
  ];
  steps.forEach((line, index) => {
    ctx.fillText(line, width / 2, 700 + index * 38);
  });

  ctx.font = "16px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "#8a7b6c";
  ctx.fillText("snapic.app", width / 2, height - 72);

  return canvas.toDataURL("image/png");
}

export function GuestQrCode({
  url,
  label = "Guest link QR code",
  eventTitle,
  coupleNames,
}: GuestQrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = displayTitle(coupleNames, eventTitle);

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

  async function downloadPrintableCard() {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await drawPrintableCard(url, heading);
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = "snapic-guest-card.png";
      anchor.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create printable card");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="guest-qr">
      <canvas ref={canvasRef} className="guest-qr__canvas" aria-label={label} role="img" />
      <div className="guest-qr__actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void downloadPrintableCard()}>
          {busy ? "Creating…" : "Download printable card"}
        </button>
        <button type="button" className="btn btn-ghost guest-qr__download" onClick={() => void downloadPng()}>
          QR only (PNG)
        </button>
      </div>
      <p className="guest-qr__hint">Print the card and place it at tables or the entrance so guests can scan easily.</p>
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}

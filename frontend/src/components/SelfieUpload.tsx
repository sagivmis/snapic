import { useCallback, useEffect, useRef, useState } from "react";
import { validatePortrait } from "../api/client";
import type { PortraitQualityResponse } from "../types";
import "../styles/SelfieUpload.scss";

interface PortraitSlotProps {
  label: string;
  file: File | null;
  previewUrl: string | null;
  onChange: (file: File | null) => void;
}

function PortraitSlot({ label, file, previewUrl, onChange }: PortraitSlotProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [quality, setQuality] = useState<PortraitQualityResponse | null>(null);
  const [checkingQuality, setCheckingQuality] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const runQualityCheck = useCallback(async (portrait: File) => {
    setCheckingQuality(true);
    try {
      const result = await validatePortrait(portrait);
      setQuality(result);
    } catch {
      setQuality(null);
    } finally {
      setCheckingQuality(false);
    }
  }, []);

  const handleFileChange = useCallback(
    (next: File | null) => {
      onChange(next);
      setQuality(null);
      if (next) {
        void runQualityCheck(next);
      }
    },
    [onChange, runQualityCheck],
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopCamera();
    setCameraOpen(false);
    setCameraError(null);
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("Could not access the camera. Upload a photo instead.");
      stopCamera();
    }
  }, [stopCamera]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          return;
        }
        const captured = new File([blob], `portrait-${Date.now()}.jpg`, { type: "image/jpeg" });
        handleFileChange(captured);
        closeCamera();
      },
      "image/jpeg",
      0.92,
    );
  }, [closeCamera, handleFileChange]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <>
      <div className="portrait-slot">
        <p className="portrait-slot__label">{label}</p>

        {file && previewUrl ? (
          <div className="portrait-slot__ready">
            <img src={previewUrl} alt={label} className="portrait-slot__avatar" />
            <div>
              <p className="portrait-slot__ready-text">Ready</p>
              <button type="button" className="btn-ghost flush-left" onClick={() => handleFileChange(null)}>
                Change
              </button>
            </div>
          </div>
        ) : (
          <div className="portrait-slot__actions">
            <label className="upload-tile portrait-slot__tile">
              <input
                type="file"
                accept="image/*"
                className="hidden-input"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
              <span className="portrait-slot__tile-label">Upload</span>
            </label>
            <button type="button" onClick={startCamera} className="upload-tile portrait-slot__tile">
              <span className="portrait-slot__tile-label">Camera</span>
            </button>
          </div>
        )}
      </div>

      {checkingQuality && <p className="portrait-slot__quality portrait-slot__quality--loading">Checking portrait...</p>}
      {quality && quality.warnings.length > 0 && (
        <ul className="portrait-slot__quality portrait-slot__quality--warn">
          {quality.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {quality?.face_detected && quality.warnings.length === 0 && !checkingQuality && (
        <p className="portrait-slot__quality portrait-slot__quality--ok">Great portrait — ready to search</p>
      )}

      {cameraOpen && (
        <div className="camera-overlay">
          <div className="camera-modal">
            <h3 className="camera-modal__title">Capture {label.toLowerCase()}</h3>
            <div className="camera-modal__video-wrap">
              <video ref={videoRef} autoPlay playsInline muted className="camera-modal__video" />
            </div>
            {cameraError && <p className="camera-modal__error">{cameraError}</p>}
            <div className="camera-modal__actions">
              <button type="button" onClick={closeCamera} className="btn-ghost">
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={Boolean(cameraError)}
                className="btn-primary"
              >
                Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface SelfieUploadProps {
  file: File | null;
  previewUrl: string | null;
  onChange: (file: File | null) => void;
  partnerFile: File | null;
  partnerPreviewUrl: string | null;
  onPartnerChange: (file: File | null) => void;
  coupleMode: boolean;
  onCoupleModeChange: (enabled: boolean) => void;
  onContinue: () => void;
  hasGallery: boolean;
}

export function SelfieUpload({
  file,
  previewUrl,
  onChange,
  partnerFile,
  partnerPreviewUrl,
  onPartnerChange,
  coupleMode,
  onCoupleModeChange,
  onContinue,
  hasGallery,
}: SelfieUploadProps) {
  const portraitReady = Boolean(file) && (!coupleMode || Boolean(partnerFile));

  return (
    <div className="selfie-upload">
      <div className="card-wedding">
        <p className="selfie-upload__intro">
          Share a clear photo of your face so we can find every picture of you from the celebration.
          {coupleMode && " In couple mode, we search for either partner."}
        </p>

        <p className="selfie-upload__privacy">
          Your portraits are used only for this search and are not stored on our servers. Shared
          result links expire after 7 days.
        </p>

        <label className="selfie-upload__couple-toggle">
          <input
            type="checkbox"
            checked={coupleMode}
            onChange={(event) => {
              onCoupleModeChange(event.target.checked);
              if (!event.target.checked) {
                onPartnerChange(null);
              }
            }}
            className="selfie-upload__checkbox"
          />
          <span>
            <span className="selfie-upload__couple-title">Couple mode</span>
            <span className="selfie-upload__couple-desc">Find photos with either person</span>
          </span>
        </label>

        <div className="selfie-upload__slots">
          <PortraitSlot label="Person 1" file={file} previewUrl={previewUrl} onChange={onChange} />
          {coupleMode && (
            <PortraitSlot
              label="Person 2"
              file={partnerFile}
              previewUrl={partnerPreviewUrl}
              onChange={onPartnerChange}
            />
          )}
        </div>

        {portraitReady && (
          <div className="selfie-upload__continue">
            <button type="button" className="btn-primary" onClick={onContinue}>
              {hasGallery ? "Review gallery →" : "Add gallery photos →"}
            </button>
          </div>
        )}
      </div>

      <p className="selfie-upload__tip">
        Tip: face the camera with good lighting — just like a wedding portrait.
      </p>
    </div>
  );
}

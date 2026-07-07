import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { validatePortrait } from "../api/client";
import { useTranslation } from "../i18n";
import type { PortraitQualityResponse } from "../types";
import "../styles/SelfieUpload.scss";
import "../styles/LegalPages.scss";

interface PortraitSlotProps {
  label: string;
  file: File | null;
  previewUrl: string | null;
  onChange: (file: File | null) => void;
}

function PortraitSlot({ label, file, previewUrl, onChange }: PortraitSlotProps) {
  const { t, tPath } = useTranslation("components.selfieUpload");
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
      setCameraError(tPath("cameraError"));
      stopCamera();
    }
  }, [stopCamera, tPath]);

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
              <p className="portrait-slot__ready-text">{tPath("ready")}</p>
              <button type="button" className="btn-ghost flush-left" onClick={() => handleFileChange(null)}>
                {tPath("change")}
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
              <span className="portrait-slot__tile-label">{tPath("upload")}</span>
            </label>
            <button type="button" onClick={startCamera} className="upload-tile portrait-slot__tile">
              <span className="portrait-slot__tile-label">{tPath("camera")}</span>
            </button>
          </div>
        )}
      </div>

      {checkingQuality && (
        <p className="portrait-slot__quality portrait-slot__quality--loading">{tPath("checkingPortrait")}</p>
      )}
      {quality && quality.warnings.length > 0 && (
        <ul className="portrait-slot__quality portrait-slot__quality--warn">
          {quality.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {quality?.face_detected && quality.warnings.length === 0 && !checkingQuality && (
        <p className="portrait-slot__quality portrait-slot__quality--ok">{tPath("portraitOk")}</p>
      )}

      {cameraOpen && (
        <div className="camera-overlay">
          <div className="camera-modal">
            <h3 className="camera-modal__title">{tPath("captureTitle", { label })}</h3>
            <div className="camera-modal__video-wrap">
              <video ref={videoRef} autoPlay playsInline muted className="camera-modal__video" />
            </div>
            {cameraError && <p className="camera-modal__error">{cameraError}</p>}
            <div className="camera-modal__actions">
              <button type="button" onClick={closeCamera} className="btn-ghost">
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={Boolean(cameraError)}
                className="btn-primary"
              >
                {tPath("capture")}
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
  requireBiometricConsent?: boolean;
  onBiometricConsentChange?: (consented: boolean) => void;
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
  requireBiometricConsent = false,
  onBiometricConsentChange,
}: SelfieUploadProps) {
  const { tPath } = useTranslation("components.selfieUpload");
  const [biometricConsent, setBiometricConsent] = useState(false);
  const portraitReady = Boolean(file) && (!coupleMode || Boolean(partnerFile));
  const consentOk = !requireBiometricConsent || biometricConsent;

  useEffect(() => {
    onBiometricConsentChange?.(biometricConsent);
  }, [biometricConsent, onBiometricConsentChange]);

  useEffect(() => {
    if (!requireBiometricConsent) {
      onBiometricConsentChange?.(true);
    }
  }, [requireBiometricConsent, onBiometricConsentChange]);

  return (
    <div className="selfie-upload">
      <div className="card-wedding">
        <p className="selfie-upload__intro">
          {tPath("intro")}
          {coupleMode && tPath("coupleModeSuffix")}
        </p>

        <p className="selfie-upload__privacy">{tPath("privacy")}</p>

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
            <span className="selfie-upload__couple-title">{tPath("coupleModeTitle")}</span>
            <span className="selfie-upload__couple-desc">{tPath("coupleModeDesc")}</span>
          </span>
        </label>

        <div className="selfie-upload__slots">
          <PortraitSlot label={tPath("person1")} file={file} previewUrl={previewUrl} onChange={onChange} />
          {coupleMode && (
            <PortraitSlot
              label={tPath("person2")}
              file={partnerFile}
              previewUrl={partnerPreviewUrl}
              onChange={onPartnerChange}
            />
          )}
        </div>

        {portraitReady && requireBiometricConsent && (
          <label className="selfie-upload__biometric-consent">
            <input
              type="checkbox"
              checked={biometricConsent}
              onChange={(event) => setBiometricConsent(event.target.checked)}
              className="selfie-upload__biometric-consent__checkbox"
            />
            <span className="selfie-upload__biometric-consent__label">
              {tPath("biometricConsent")}{" "}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                {tPath("privacyLink")}
              </Link>
            </span>
          </label>
        )}

        {portraitReady && consentOk && (
          <div className="selfie-upload__continue">
            <button type="button" className="btn-primary" onClick={onContinue}>
              {hasGallery ? tPath("reviewGallery") : tPath("addGallery")}
            </button>
          </div>
        )}
      </div>

      <p className="selfie-upload__tip">{tPath("tip")}</p>
    </div>
  );
}

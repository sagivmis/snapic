import { useEffect, useMemo, useState } from "react";
import { matchPhotos } from "../api/client";
import { InstallPrompt } from "../components/InstallPrompt";
import { GalleryInput } from "../components/GalleryInput";
import { ResultsGrid } from "../components/ResultsGrid";
import { SelfieUpload } from "../components/SelfieUpload";
import { Sidebar } from "../components/Sidebar";
import type { AppTab } from "../navigation";
import { NAV_ITEMS } from "../navigation";
import type { MatchResponse } from "../types";
import "../styles/App.scss";

function parseUrls(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function LegacyDemoPage() {
  const [activeTab, setActiveTab] = useState<AppTab>("portrait");
  const [coupleMode, setCoupleMode] = useState(false);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [partnerSelfie, setPartnerSelfie] = useState<File | null>(null);
  const [partnerPreview, setPartnerPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryUrlsText, setGalleryUrlsText] = useState("");
  const [threshold, setThreshold] = useState(0.4);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResponse | null>(null);

  const galleryUrls = useMemo(() => parseUrls(galleryUrlsText), [galleryUrlsText]);
  const galleryCount = galleryFiles.length + galleryUrls.length;
  const hasPortrait = coupleMode
    ? Boolean(selfie) && Boolean(partnerSelfie)
    : Boolean(selfie);
  const canMatch = hasPortrait && galleryCount > 0;
  const activeItem = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];

  useEffect(() => {
    if (!selfie) {
      setSelfiePreview(null);
      return;
    }
    const url = URL.createObjectURL(selfie);
    setSelfiePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selfie]);

  useEffect(() => {
    if (!partnerSelfie) {
      setPartnerPreview(null);
      return;
    }
    const url = URL.createObjectURL(partnerSelfie);
    setPartnerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [partnerSelfie]);

  async function handleMatch() {
    if (!hasPortrait) {
      setActiveTab("portrait");
      return;
    }
    if (galleryCount === 0) {
      setActiveTab("gallery");
      return;
    }
    if (!selfie) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await matchPhotos({
        selfie,
        partnerSelfie: coupleMode ? partnerSelfie : null,
        galleryFiles,
        galleryUrls,
        threshold,
      });
      setResult(response);
      setActiveTab("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <InstallPrompt />
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasPortrait={hasPortrait}
        galleryCount={galleryCount}
        matchCount={result?.matched.length ?? null}
        canMatch={canMatch}
        loading={loading}
        threshold={threshold}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((value) => !value)}
        onThresholdChange={setThreshold}
        onMatch={handleMatch}
      />

      <main className="main">
        <header className="header">
          <p className="header__step">Step {activeItem.step} of 3</p>
          <h1 className="header__title">{activeItem.label}</h1>
          <p className="header__desc">{activeItem.description}</p>
        </header>

        <div className="content">
          {activeTab === "portrait" && (
            <SelfieUpload
              file={selfie}
              previewUrl={selfiePreview}
              onChange={setSelfie}
              partnerFile={partnerSelfie}
              partnerPreviewUrl={partnerPreview}
              onPartnerChange={setPartnerSelfie}
              coupleMode={coupleMode}
              onCoupleModeChange={setCoupleMode}
              onContinue={() => setActiveTab("gallery")}
              hasGallery={galleryCount > 0}
            />
          )}

          {activeTab === "gallery" && (
            <GalleryInput
              files={galleryFiles}
              urlsText={galleryUrlsText}
              onFilesChange={setGalleryFiles}
              onUrlsTextChange={setGalleryUrlsText}
              hasPortrait={hasPortrait}
              onBack={() => setActiveTab("portrait")}
            />
          )}

          {activeTab === "results" && (
            <ResultsGrid
              result={result}
              loading={loading}
              onStartSearch={handleMatch}
              canMatch={canMatch}
            />
          )}

          {error && <p className="error-banner">{error}</p>}
        </div>
      </main>
    </div>
  );
}

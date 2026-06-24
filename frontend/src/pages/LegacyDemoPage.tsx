import { useEffect, useMemo, useState } from "react";
import { matchPhotosStream } from "../api/client";
import { InstallPrompt } from "../components/InstallPrompt";
import { GalleryInput } from "../components/GalleryInput";
import { ResultsGrid } from "../components/ResultsGrid";
import { SelfieUpload } from "../components/SelfieUpload";
import { Sidebar } from "../components/Sidebar";
import { useTranslation } from "../i18n";
import type { AppTab } from "../navigation";
import { getNavItems } from "../navigation";
import type { MatchResponse } from "../types";
import { MAX_DEMO_GALLERY_PHOTOS } from "../lib/demoLimits";
import "../styles/App.scss";

function parseUrls(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function LegacyDemoPage() {
  const { t, tPath } = useTranslation("demo");
  const { tPath: tNav } = useTranslation("navigation");
  const navItems = useMemo(() => getNavItems(tNav), [tNav]);

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
  const [matchProgress, setMatchProgress] = useState<{ processed: number; total: number } | null>(
    null,
  );

  const galleryUrls = useMemo(() => parseUrls(galleryUrlsText), [galleryUrlsText]);
  const galleryCount = galleryFiles.length + galleryUrls.length;
  const hasPortrait = coupleMode
    ? Boolean(selfie) && Boolean(partnerSelfie)
    : Boolean(selfie);
  const canMatch = hasPortrait && galleryCount > 0 && galleryCount <= MAX_DEMO_GALLERY_PHOTOS;
  const activeItem = navItems.find((item) => item.id === activeTab) ?? navItems[0];

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
    if (galleryCount > MAX_DEMO_GALLERY_PHOTOS) {
      setActiveTab("gallery");
      setError(tPath("demoLimitError", { max: MAX_DEMO_GALLERY_PHOTOS }));
      return;
    }
    if (!selfie) {
      return;
    }

    setLoading(true);
    setError(null);
    setActiveTab("results");
    setMatchProgress({ processed: 0, total: galleryCount });
    setResult({
      reference_face_detected: true,
      threshold,
      total_gallery: galleryCount,
      matched: [],
      skipped: [],
      couple_mode: coupleMode,
    });

    try {
      const response = await matchPhotosStream(
        {
          selfie,
          partnerSelfie: coupleMode ? partnerSelfie : null,
          galleryFiles,
          galleryUrls,
          threshold,
        },
        (event) => {
          if (event.type === "progress") {
            setMatchProgress({ processed: event.processed, total: event.total });
          }
          if (event.type === "match") {
            setResult((prev) =>
              prev
                ? {
                    ...prev,
                    matched: [...prev.matched, event.photo],
                  }
                : null,
            );
          }
          if (event.type === "complete") {
            setResult(event.result);
          }
        },
      );
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("somethingWentWrong"));
      setActiveTab("gallery");
      setResult(null);
    } finally {
      setLoading(false);
      setMatchProgress(null);
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
          <p className="header__step">{tPath("stepOf3", { step: activeItem.step })}</p>
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
              maxPhotos={MAX_DEMO_GALLERY_PHOTOS}
            />
          )}

          {activeTab === "results" && (
            <ResultsGrid
              result={result}
              loading={loading}
              matchProgress={matchProgress}
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

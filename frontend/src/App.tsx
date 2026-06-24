import { useEffect, useMemo, useState } from "react";
import { fetchSharedResults, matchPhotos } from "./api/client";
import { InstallPrompt } from "./components/InstallPrompt";
import { GalleryInput } from "./components/GalleryInput";
import { ResultsGrid } from "./components/ResultsGrid";
import { SelfieUpload } from "./components/SelfieUpload";
import { Sidebar } from "./components/Sidebar";
import { useTranslation } from "./i18n";
import type { AppTab } from "./navigation";
import { getNavItems } from "./navigation";
import type { MatchResponse } from "./types";
import "./styles/App.scss";

function parseUrls(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getShareIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("share");
}

export default function App() {
  const { t, tPath: tShare } = useTranslation("events.share");
  const { tPath: tDemo } = useTranslation("demo");
  const { tPath: tNav } = useTranslation("navigation");
  const navItems = useMemo(() => getNavItems(tNav), [tNav]);

  const [isGuestView, setIsGuestView] = useState(false);
  const [loadingShare, setLoadingShare] = useState(Boolean(getShareIdFromUrl()));
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

  useEffect(() => {
    const shareId = getShareIdFromUrl();
    if (!shareId) {
      return;
    }

    setIsGuestView(true);
    setLoadingShare(true);
    setActiveTab("results");

    fetchSharedResults(shareId)
      .then((shared) => {
        setResult(shared);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : tShare("loadFailed"));
      })
      .finally(() => setLoadingShare(false));
  }, []);

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
      setError(err instanceof Error ? err.message : t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  if (isGuestView) {
    return (
      <div className="app-guest">
        <InstallPrompt />
        <header className="header header--guest">
          <p className="header__step">{tShare("eyebrow")}</p>
          <h1 className="header__title">{tShare("title")}</h1>
          <p className="header__desc">{tShare("desc")}</p>
        </header>

        <div className="content content--guest">
          <ResultsGrid
            result={result}
            loading={loadingShare}
            onStartSearch={() => undefined}
            canMatch={false}
            readOnly
          />
          {error && <p className="error-banner error-banner--centered">{error}</p>}
        </div>
      </div>
    );
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
          <p className="header__step">{tDemo("stepOf3", { step: activeItem.step })}</p>
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

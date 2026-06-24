import { useTranslation } from "../i18n";
import "../styles/GalleryInput.scss";
import { countGalleryUrls, remainingGallerySlots, trimUrlsText } from "../lib/demoLimits";

interface GalleryInputProps {
  files: File[];
  urlsText: string;
  onFilesChange: (files: File[]) => void;
  onUrlsTextChange: (text: string) => void;
  hasPortrait: boolean;
  onBack: () => void;
  maxPhotos?: number;
}

export function GalleryInput({
  files,
  urlsText,
  onFilesChange,
  onUrlsTextChange,
  hasPortrait,
  onBack,
  maxPhotos,
}: GalleryInputProps) {
  const { tPath } = useTranslation("components.galleryInput");
  const { tPath: tDemo } = useTranslation("demo");
  const urlCount = countGalleryUrls(urlsText);
  const totalCount = files.length + urlCount;
  const atLimit = maxPhotos !== undefined && totalCount >= maxPhotos;
  const remaining = maxPhotos !== undefined ? remainingGallerySlots(files.length, urlsText, maxPhotos) : null;

  function handleFilesAdd(selected: File[]) {
    if (maxPhotos === undefined) {
      onFilesChange([...files, ...selected]);
      return;
    }
    if (remaining === 0) {
      return;
    }
    onFilesChange([...files, ...selected.slice(0, remaining ?? 0)]);
  }

  function handleUrlsChange(text: string) {
    if (maxPhotos === undefined) {
      onUrlsTextChange(text);
      return;
    }
    const maxUrls = Math.max(0, maxPhotos - files.length);
    onUrlsTextChange(trimUrlsText(text, maxUrls));
  }

  const uploadedHeaderKey = files.length === 1 ? "uploadedHeader_one" : "uploadedHeader_other";

  return (
    <div className="gallery-input">
      <div className="card-wedding">
        <p className="gallery-input__intro">
          {tPath("intro")}
          {maxPhotos !== undefined && tPath("demoLimitSuffix", { max: maxPhotos })}
        </p>

        <label className={`upload-tile gallery-input__upload${atLimit ? " gallery-input__upload--disabled" : ""}`}>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden-input"
            disabled={atLimit}
            onChange={(event) => {
              handleFilesAdd(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <span className="gallery-input__upload-title">{tPath("addPhotos")}</span>
          <span className="gallery-input__upload-desc">{tPath("addPhotosDesc")}</span>
        </label>

        {files.length > 0 && (
          <div className="gallery-input__files-section">
            <p className="gallery-input__files-header">
              {tPath(uploadedHeaderKey, { count: files.length })}
            </p>
            <div className="gallery-input__files-scroll">
              <ul className="gallery-input__files-list">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="gallery-input__file-item">
                    <span className="gallery-input__file-name">{file.name}</span>
                    <button
                      type="button"
                      className="gallery-input__file-remove"
                      onClick={() => onFilesChange(files.filter((_, i) => i !== index))}
                    >
                      {tPath("remove")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="gallery-input__urls">
          <label htmlFor="gallery-urls" className="gallery-input__urls-label">
            {tPath("urlsLabel")}
          </label>
          <textarea
            id="gallery-urls"
            rows={4}
            value={urlsText}
            onChange={(event) => handleUrlsChange(event.target.value)}
            placeholder="https://gallery.example.com/photo1.jpg&#10;https://gallery.example.com/photo2.jpg"
            className="gallery-input__textarea"
          />
          <p className="gallery-input__urls-hint">
            {tPath("urlsHint")}
            {maxPhotos !== undefined && ` · ${tDemo("upToPhotos", { max: maxPhotos })}`}
          </p>
        </div>
      </div>

      <div className="gallery-input__footer">
        <button type="button" onClick={onBack} className="btn-ghost">
          {tPath("backToPortrait")}
        </button>
        {totalCount > 0 && (
          <p className="gallery-input__status">
            <span className="gallery-input__status-count">{totalCount}</span>
            {maxPhotos !== undefined
              ? tPath("statusReadyMax", { count: totalCount, max: maxPhotos })
              : tPath("statusReady", { count: totalCount })}
            {hasPortrait ? ` — ${tDemo("useFindMyPhotos")}` : ` — ${tDemo("addPortraitFirst")}`}
            {atLimit && maxPhotos !== undefined && <> · {tDemo("limitReached")}</>}
          </p>
        )}
      </div>
    </div>
  );
}

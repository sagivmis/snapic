import "../styles/GalleryInput.scss";

interface GalleryInputProps {
  files: File[];
  urlsText: string;
  onFilesChange: (files: File[]) => void;
  onUrlsTextChange: (text: string) => void;
  hasPortrait: boolean;
  onBack: () => void;
}

export function GalleryInput({
  files,
  urlsText,
  onFilesChange,
  onUrlsTextChange,
  hasPortrait,
  onBack,
}: GalleryInputProps) {
  const totalCount = files.length + urlsText.split("\n").filter((line) => line.trim()).length;

  return (
    <div className="gallery-input">
      <div className="card-wedding">
        <p className="gallery-input__intro">
          Add the wedding album, photographer&apos;s gallery, or shared folder photos. We&apos;ll
          search through every image to find the ones you&apos;re in.
        </p>

        <label className="upload-tile gallery-input__upload">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden-input"
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              onFilesChange([...files, ...selected]);
            }}
          />
          <span className="gallery-input__upload-title">Add photos</span>
          <span className="gallery-input__upload-desc">Select multiple files at once</span>
        </label>

        {files.length > 0 && (
          <div className="gallery-input__files-section">
            <p className="gallery-input__files-header">
              {files.length} uploaded photo{files.length === 1 ? "" : "s"}
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
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="gallery-input__urls">
          <label htmlFor="gallery-urls" className="gallery-input__urls-label">
            Or paste image links
          </label>
          <textarea
            id="gallery-urls"
            rows={4}
            value={urlsText}
            onChange={(event) => onUrlsTextChange(event.target.value)}
            placeholder="https://gallery.example.com/photo1.jpg&#10;https://gallery.example.com/photo2.jpg"
            className="gallery-input__textarea"
          />
          <p className="gallery-input__urls-hint">One URL per line — great for shared albums</p>
        </div>
      </div>

      <div className="gallery-input__footer">
        <button type="button" onClick={onBack} className="btn-ghost">
          ← Back to portrait
        </button>
        {totalCount > 0 && (
          <p className="gallery-input__status">
            <span className="gallery-input__status-count">{totalCount}</span> photos ready
            {hasPortrait ? " — use Find my photos in the sidebar" : " — add your portrait first"}
          </p>
        )}
      </div>
    </div>
  );
}

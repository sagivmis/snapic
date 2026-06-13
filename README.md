# Snapic — Face Photo Matcher

Snapic finds your photos inside a gallery using a selfie as reference. Upload a clear selfie plus a set of gallery images (files and/or URLs), and the app returns the photos that contain your face with confidence scores.

## How it works

1. Extract a face embedding from your selfie (InsightFace `buffalo_l`).
2. Detect faces in each gallery image and compute embeddings.
3. Compare cosine similarity against a configurable threshold.
4. Return matched photos with preview thumbnails and scores.

## Prerequisites

- **Python 3.11 or 3.12** (3.14 is not supported yet by onnxruntime on Windows)
- **Node.js 18+**
- **Microsoft Visual C++ Redistributable** (2015–2022 x64) — required by onnxruntime on Windows
- ~100 MB disk space for InsightFace model weights (downloaded on first backend start)

> **Windows tip:** If you have multiple Python versions installed, create the virtualenv with 3.12 explicitly:
> ```powershell
> py -3.12 -m venv .venv
> # or
> & "$env:LOCALAPPDATA\Python\pythoncore-3.12-64\python.exe" -m venv .venv
> ```

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn snapic.main:app --reload --app-dir src --host 127.0.0.1 --port 8000
```

On first run, InsightFace downloads the `buffalo_l` model pack automatically.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` requests to the backend on port 8000.

## API

### `GET /api/health`

Returns `{ "status": "ok" }`.

### `POST /api/match`

`multipart/form-data` fields:

| Field | Type | Required |
|-------|------|----------|
| `selfie` | file | yes |
| `gallery_files` | file[] | no |
| `gallery_urls` | JSON string array | no |
| `threshold` | float (default `0.4`) | no |

At least one gallery file or URL is required.

## Testing

```bash
cd backend
.venv\Scripts\activate   # or source .venv/bin/activate
pip install -r requirements.txt
pytest
```

Unit tests cover cosine similarity and threshold logic. Place sample images in `samples/` for manual integration testing.

## Project structure

```
snapic/
├── backend/          # FastAPI + InsightFace
├── frontend/         # Vite + React + SCSS
├── samples/          # Local test images (gitignored)
└── README.md
```

## Notes

- Default similarity threshold is **0.4** (typical useful range: 0.35–0.55).
- Gallery images with no detectable face are reported under `skipped`.
- URL images must be publicly accessible and under 10 MB.
- Large galleries (100+ photos) are processed sequentially in v1.

## Troubleshooting

### Render deploy: "Ran out of memory (used over 512MB)"

Render **Free** and **Starter** instances only have **512 MB RAM**. InsightFace exceeds that even with `buffalo_s`.

**Fix:** use **Standard** (2 GB, ~$25/mo) — configured in `render.yaml`. The app loads the face model on the first match request (not at startup) so deploy health checks stay light.

If the blueprint does not upgrade the instance type automatically, open **Render → snapic-api → Settings → Instance Type** and select **Standard**.

### `ImportError: Unable to import dependency onnxruntime` (Windows)

This usually means onnxruntime's native DLL failed to load. Fix in order:

1. **Use Python 3.11 or 3.12** — recreate the venv if you installed with 3.14.
2. **Install/update Visual C++ Redistributable:**
   ```powershell
   winget install Microsoft.VCRedist.2015+.x64
   ```
3. **Reinstall pinned onnxruntime** (already constrained in `requirements.txt`):
   ```powershell
   pip install "onnxruntime>=1.19.0,<1.21.0" --force-reinstall
   ```

Verify with:
```powershell
python -c "import onnxruntime; print(onnxruntime.__version__)"
```

## Deployment

Snapic is split across two hosts:

| Part | Platform | Why |
|------|----------|-----|
| **Frontend** | [Vercel](https://vercel.com) | Static Vite/React app |
| **Backend** | [Render](https://render.com) | InsightFace + onnxruntime need a full Python server (too heavy for Vercel serverless) |

### 1. Push to GitHub

```bash
git remote add origin https://github.com/sagivmis/snapic.git
git branch -M main
git push -u origin main
```

Repo: [github.com/sagivmis/snapic](https://github.com/sagivmis/snapic)

### 2. Deploy the API (Render)

1. In Render: **New → Blueprint** and connect the GitHub repo (uses [`render.yaml`](render.yaml)).
2. Set environment variable on the web service:
   ```
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
   (Add preview URLs too if needed, comma-separated.)
3. Note the Render URL, e.g. `https://snapic-api.onrender.com`.

First request after idle may be slow (free tier spin-up + model load).

### 3. Deploy the frontend (Vercel + GitHub)

1. Open [vercel.com/new](https://vercel.com/new) and import **sagivmis/snapic** from GitHub.
2. Configure the project:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
3. Add environment variable (Production + Preview):
   ```
   VITE_API_BASE_URL=https://snapic-api.onrender.com
   ```
4. Deploy. Every push to `main` triggers a production deploy; PRs get preview URLs.

Leave `VITE_API_BASE_URL` **unset** for local dev — the Vite proxy handles `/api`.

If you already have a Vercel project linked locally, open **Project Settings → Git** and connect the same GitHub repo instead of creating a new project.

### 4. Verify

- `https://your-api.onrender.com/api/health` → `{"status":"ok"}`
- Open your Vercel URL, upload a selfie + gallery, run a match.

## License

MIT

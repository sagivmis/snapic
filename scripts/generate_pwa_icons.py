"""Generate Snapic PWA / favicon PNG assets into frontend/public/."""

from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit("Install Pillow: pip install pillow") from exc

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public"
BG = (250, 246, 239)
ACCENT = (201, 168, 98)
TEXT = (74, 64, 54)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)
    margin = size // 8
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=size // 6,
        fill=ACCENT + (255,),
    )
    font_size = max(size // 3, 12)
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()
    letter = "S"
    bbox = draw.textbbox((0, 0), letter, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((size - tw) / 2, (size - th) / 2 - size * 0.04), letter, fill=TEXT + (255,), font=font)
    return img


def draw_og() -> Image.Image:
    w, h = 1200, 630
    img = Image.new("RGBA", (w, h), BG + (255,))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((80, 120, 520, 520), radius=48, fill=ACCENT + (255,))
    try:
        title_font = ImageFont.truetype("arial.ttf", 96)
        sub_font = ImageFont.truetype("arial.ttf", 42)
    except OSError:
        title_font = ImageFont.load_default()
        sub_font = ImageFont.load_default()
    draw.text((600, 200), "Snapic", fill=TEXT + (255,), font=title_font)
    draw.text((600, 320), "Find yourself in every wedding photo", fill=TEXT + (200,), font=sub_font)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {
        "favicon.png": 32,
        "apple-touch-icon.png": 180,
        "pwa-192x192.png": 192,
        "pwa-512x512.png": 512,
    }
    for name, size in sizes.items():
        draw_icon(size).save(OUT / name, format="PNG")
    draw_og().save(OUT / "og-image.png", format="PNG")
    print(f"Wrote icons to {OUT}")


if __name__ == "__main__":
    main()

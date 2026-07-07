import { SITE_ORIGIN } from "./site";

const SITE_NAME = "Snapic";
const DEFAULT_OG_IMAGE = "/og-image.png";

export interface PageMetaOptions {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}

function origin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return SITE_ORIGIN;
}

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function applyPageMeta(options: PageMetaOptions): void {
  if (typeof document === "undefined") {
    return;
  }

  const fullTitle = options.title.includes(SITE_NAME)
    ? options.title
    : `${options.title} — ${SITE_NAME}`;
  const url = `${origin()}${options.path ?? window.location.pathname}`;
  const image = options.image ?? `${origin()}${DEFAULT_OG_IMAGE}`;

  document.title = fullTitle;
  upsertMeta("name", "description", options.description);
  upsertMeta("name", "robots", options.noIndex ? "noindex, nofollow" : "index, follow");
  upsertLink("canonical", url);

  upsertMeta("property", "og:title", fullTitle);
  upsertMeta("property", "og:description", options.description);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:type", options.type ?? "website");
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:site_name", SITE_NAME);

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", fullTitle);
  upsertMeta("name", "twitter:description", options.description);
  upsertMeta("name", "twitter:image", image);
}

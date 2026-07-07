import { useEffect } from "react";
import { applyPageMeta, type PageMetaOptions } from "../lib/pageMeta";

export function PageMeta(options: PageMetaOptions) {
  useEffect(() => {
    applyPageMeta(options);
  }, [options.title, options.description, options.path, options.image, options.type, options.noIndex]);

  return null;
}

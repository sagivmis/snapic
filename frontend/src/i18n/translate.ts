import en from "./locales/en.json";

export type TranslationParams = Record<string, string | number>;
export type TranslationNode = { [key: string]: TranslationNode | string };

const catalog = en as TranslationNode;

function isDev(): boolean {
  return import.meta.env.DEV;
}

function warnMissing(key: string, mode: "path" | "global"): void {
  if (isDev()) {
    console.warn(`[i18n] Missing ${mode} translation: ${key}`);
  }
}

export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? `{{${name}}}` : String(value);
  });
}

function leafKey(key: string): string {
  const parts = key.split(".").filter(Boolean);
  return parts[parts.length - 1] ?? key;
}

export function resolvePath(path: string, root: TranslationNode = catalog): string | undefined {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }

  let current: TranslationNode | string = root;
  for (const segment of segments) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return typeof current === "string" ? current : undefined;
}

export function resolveGlobal(key: string, root: TranslationNode = catalog): string | undefined {
  const target = leafKey(key);

  function search(node: TranslationNode | string): string | undefined {
    if (typeof node === "string") {
      return undefined;
    }
    for (const [name, value] of Object.entries(node)) {
      if (name === target) {
        if (typeof value === "string") {
          return value;
        }
        continue;
      }
      if (typeof value === "object" && value !== null) {
        const found = search(value);
        if (found !== undefined) {
          return found;
        }
      }
    }
    return undefined;
  }

  return search(root);
}

function joinPath(basePath: string | undefined, key: string): string {
  const trimmedKey = key.trim();
  if (!basePath?.trim()) {
    return trimmedKey;
  }
  if (!trimmedKey) {
    return basePath.trim();
  }
  return `${basePath.trim()}.${trimmedKey}`;
}

export interface Translator {
  t: (key: string, params?: TranslationParams) => string;
  tPath: (key: string, params?: TranslationParams) => string;
}

export function createTranslator(basePath?: string): Translator {
  function t(key: string, params?: TranslationParams): string {
    const resolved = resolveGlobal(key);
    if (resolved === undefined) {
      warnMissing(key, "global");
      return key;
    }
    return interpolate(resolved, params);
  }

  function tPath(key: string, params?: TranslationParams): string {
    const fullPath = joinPath(basePath, key);
    const resolved = resolvePath(fullPath);
    if (resolved === undefined) {
      warnMissing(fullPath, "path");
      return key;
    }
    return interpolate(resolved, params);
  }

  return { t, tPath };
}

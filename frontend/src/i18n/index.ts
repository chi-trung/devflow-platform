import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";

// en is the fallback language, so it stays in the entry chunk: the very first
// paint always has real copy. vi is ~92 KB of strings most visitors never read,
// and shipping it in the entry cost 24.9 KB of gzip on the critical path for
// every route. It is fetched on demand (ensureLocale) and lands in its own
// chunk, which the browser caches separately from the entry hash.

// Dynamic imports, one per shipped non-fallback locale. Region subtags
// collapse to the bundle we actually ship (vi-VN -> vi).
const LOCALE_LOADERS: Record<string, () => Promise<unknown>> = {
  vi: () => import("./vi.json"),
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "devflow.language",
    },
  });

// index.html hardcodes <html lang="en">, which goes stale the moment the
// detector (or a visitor toggle) picks Vietnamese. Screen readers choose
// pronunciation from this attribute and crawlers flag a mismatch against the
// rendered copy, so keep it in sync for the initial language and every change.
const syncLang = (lng: string) =>
  document.documentElement.setAttribute(
    "lang",
    lng?.startsWith("vi") ? "vi" : "en",
  );
syncLang(i18n.language);
i18n.on("languageChanged", syncLang);

// The fallback locale ships in the entry, so nothing has to be fetched for it.
const loaded = new Set<string>(["en"]);
const inflight = new Map<string, Promise<void>>();

// Resolves once lng's bundle is registered with i18next. Without this, a
// Vietnamese visitor's first paint would show raw translation keys: i18next
// falls back per-key, and with no vi bundle registered it has nothing to fall
// back to. Callers that wait before rendering (main.tsx, SettingsPage) never
// show a key. The same memoisation means a re-toggle is instant.
export function ensureLocale(lng: string | undefined): Promise<void> {
  const code = Object.keys(LOCALE_LOADERS).find((c) => lng?.startsWith(c));
  if (!code) return Promise.resolve(); // en, or anything we do not ship
  if (loaded.has(code)) return Promise.resolve();
  const existing = inflight.get(code);
  if (existing) return existing;

  const load = LOCALE_LOADERS[code]()
    .then((mod) => {
      // A dynamic JSON import is a module namespace object; unwrap the default
      // export so addResourceBundle gets the string tree itself.
      // deep + overwrite so a re-shipped vi.json fully replaces the old bundle.
      i18n.addResourceBundle(
        code,
        "translation",
        (mod as { default: unknown }).default,
        true,
        true,
      );
      loaded.add(code);
    })
    .finally(() => {
      inflight.delete(code);
    });
  inflight.set(code, load);
  return load;
}

export default i18n;

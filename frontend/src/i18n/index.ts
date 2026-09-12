import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";
import vi from "./vi.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
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

export default i18n;

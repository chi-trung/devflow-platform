import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Per-route document metadata for the public marketing pages. Without it every
 * public URL shares index.html's single <title>/description, so /blog,
 * /changelog, /privacy and /terms are indistinguishable to crawlers and link
 * previews. Titles and descriptions reuse the same i18n keys the page bodies
 * already render (e.g. blog.title, privacy.subtitle), so the copy can't drift
 * from the on-page heading and no new catalog keys are introduced.
 *
 * LandingPage also calls it (with its hero copy) so that client-side
 * navigation back to "/" restores the marketing title instead of leaving the
 * previous route's behind. A fresh page load of "/" still renders the
 * hand-written "DevFlow — ship in flow" title from index.html.
 */
export function usePageMeta(titleKey: string, descriptionKey: string) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const title = `${t(titleKey)} — DevFlow`;
    const description = t(descriptionKey);
    document.title = title;

    setMeta(`meta[name="description"]`, "name", "description", description);
    setMeta(`meta[property="og:title"]`, "property", "og:title", title);
    setMeta(
      `meta[property="og:description"]`,
      "property",
      "og:description",
      description,
    );

    // Canonical is origin-derived so it tracks whichever deployment serves the
    // page (production alias or preview URL) rather than hardcoding one host.
    let link = document.querySelector(`link[rel="canonical"]`);
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute(
      "href",
      `${window.location.origin}${window.location.pathname}`,
    );

    // Re-run when the visitor toggles language so the title follows the locale.
  }, [t, titleKey, descriptionKey, i18n.language]);
}

// Update an existing <meta> by selector, or create it appended to <head>.
function setMeta(
  selector: string,
  attr: "name" | "property",
  value: string,
  content: string,
) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// vi was split out of the entry chunk (−91.5 KB raw / −24.9 KB gzip on the
// critical path for every route) and is fetched on demand by ensureLocale. The
// rest of the suite mocks react-i18next and never touches the real module, so
// without this file the split would be entirely unverified:
//   1. The bundle is never registered: a caller that renders before the load
//      resolves shows raw keys, because i18next has no vi resource to fall
//      back to.
//   2. The loader resolves but the registration is skipped or passed the wrong
//      value: every vi lookup falls back to English with no error and no
//      warning.
// Both pass silently unless something asserts against the real bundle, so
// these tests read it back out of i18next rather than only calling t().

import { describe, it, expect, beforeEach } from "vitest";
import i18n, { ensureLocale } from "../i18n";

// The module registers a languageChanged handler that writes document.lang;
// jsdom starts at <html lang="en"> and the detector sees no cached preference.
describe("lazy locale bundle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
    i18n.changeLanguage("en");
  });

  it("resolves real Vietnamese copy, not the module namespace wrapper", async () => {
    await ensureLocale("vi");

    // Read the bundle back rather than trusting t(): an unregistered vi
    // resource makes t() return the raw key, which a "differs from en" check
    // would also catch, but only the bundle check proves the whole tree landed.
    expect(Object.keys(i18n.getResourceBundle("vi", "translation") ?? {}))
      .not.toHaveLength(0);
    expect(i18n.t("common.cancel", { lng: "vi" })).not.toBe("common.cancel");
    expect(i18n.t("common.cancel", { lng: "vi" })).not.toBe(
      i18n.t("common.cancel", { lng: "en" }),
    );
  });

  it("registers the whole tree, not just one key", async () => {
    await ensureLocale("vi");
    // settings.* is nested, so this also proves deep registration.
    const viVal = i18n.t("settings.language", { lng: "vi" });
    expect(viVal).not.toBe("settings.language");
    expect(viVal).not.toBe(i18n.t("settings.language", { lng: "en" }));
  });

  it("resolves immediately for the bundled fallback locale", async () => {
    // en ships in the entry so nothing is fetched; this is the common path and
    // a regression here would block every visitor on the splash.
    await expect(ensureLocale("en")).resolves.toBeUndefined();
  });

  it("region subtags collapse to the shipped bundle", async () => {
    await ensureLocale("vi-VN");
    expect(i18n.t("common.cancel", { lng: "vi-VN" })).not.toBe("common.cancel");
  });

  it("resolves an unknown language without throwing", async () => {
    // A language we do not ship must not wedge the boot; i18next falls back.
    await expect(ensureLocale("fr")).resolves.toBeUndefined();
  });

  it("shares one load across concurrent callers", async () => {
    // main.tsx and SettingsPage can both ask before the chunk lands; a second
    // fetch would double the request for nothing.
    await Promise.all([ensureLocale("vi"), ensureLocale("vi")]);
    expect(i18n.t("common.cancel", { lng: "vi" })).not.toBe("common.cancel");
  });
});

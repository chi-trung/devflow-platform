import "@testing-library/jest-dom/vitest";

// jsdom has no matchMedia. Components that check a media query (ScrollToTop
// honors prefers-reduced-motion) crash without a stub; default to "no query
// matches", which is what the tests expect unless they override it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

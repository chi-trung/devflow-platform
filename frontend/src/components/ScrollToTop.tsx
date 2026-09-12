import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// react-router keeps scrollY across client-side navigation, so clicking a
// footer/header link on a marketing page opened the next route mid-scroll
// (the user stayed parked at the previous reading position). Reset on every
// path change, but hash links work the other way: /#pricing must land on the
// section. The sections mount after the lazy landing chunk resolves, past
// the browser's one-shot native anchor jump, so keep looking for the element
// until it appears (index.css's `html { scroll-behavior: smooth }` is
// honored via the behavior option).
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    let raf = 0;
    const deadline = performance.now() + 3000;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        // An explicit behavior option overrides index.css's scroll-behavior,
        // so honor a reduced-motion request here too instead of relying on the
        // stylesheet.
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        el.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "start",
        });
        return;
      }
      if (performance.now() < deadline) raf = requestAnimationFrame(tryScroll);
    };
    tryScroll();
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);
  return null;
}

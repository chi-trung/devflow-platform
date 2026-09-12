import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteErrorBoundary, isChunkLoadError } from "../components/RouteErrorBoundary";

// Mock i18n like the other page tests (raw keys back).
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

// jsdom fires a "Not implemented: navigation" noise error for location.reload;
// replace the whole location object so the boundary's call is a silent spy.
function stubReload() {
  const reload = vi.fn();
  const original = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...original, reload },
  });
  return reload;
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("isChunkLoadError", () => {
  it("matches Chrome/Firefox and Safari dynamic-import and CSS-preload failures", () => {
    expect(
      isChunkLoadError(
        new Error("Failed to fetch dynamically imported module: https://x/assets/Board-abc.js"),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(
      true,
    );
    // Vite's preload helper wording when a route's CSS chunk is gone.
    expect(isChunkLoadError(new Error("Unable to preload CSS for /assets/Board-abc.css"))).toBe(
      true,
    );
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(
      false,
    );
  });
});

describe("RouteErrorBoundary", () => {
  it("auto-reloads once on a stale-chunk failure", () => {
    // componentDidCatch would log to console.error; silence it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = stubReload();
    render(
      <RouteErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: https://x/assets/a.js" />
      </RouteErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("devflow.chunkReload")).toBe("1");
  });

  it("shows the retry UI on a second failure after an auto-reload", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sessionStorage.setItem("devflow.chunkReload", "1");
    const reload = stubReload();
    render(
      <RouteErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: https://x/assets/a.js" />
      </RouteErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("common.loadError")).toBeInTheDocument();
    expect(screen.getByText("common.retry")).toBeInTheDocument();
  });

  it("renders the fallback for ordinary render errors without reloading", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = stubReload();
    render(
      <RouteErrorBoundary>
        <Boom message="TypeError: reading 'foo'" />
      </RouteErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("common.unexpectedError")).toBeInTheDocument();
  });

  it("keeps children visible when nothing throws", () => {
    render(
      <RouteErrorBoundary>
        <p>child content</p>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});

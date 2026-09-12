import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/Button";

const RELOAD_KEY = "devflow.chunkReload";

// Vite's dynamic-import failure wording differs per browser ("Failed to fetch
// dynamically imported module" in Chrome/Firefox, "Importing a module script
// failed" in Safari). All of them mean the same thing for this app: the HTML
// still open references chunk filenames a newer deploy deleted, and the SPA
// rewrite hands the importer index.html where a script was expected. A
// one-shot reload picks up the fresh index.html and its new chunk names.
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed/i.test(
    message,
  );
}

function wasAutoReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_KEY) === "1";
  } catch {
    return false;
  }
}

function markAutoReload(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    // Private-mode sessionStorage throws; the fallback UI still works.
  }
}

function ChunkFallback({ error }: { error: Error }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <RefreshCw className="size-7" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t("common.error")}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {isChunkLoadError(error)
          ? t("common.loadError")
          : t("common.unexpectedError")}
      </p>
      <Button
        className="mt-6"
        onClick={() => {
          try {
            sessionStorage.removeItem(RELOAD_KEY);
          } catch {
            // ignore
          }
          window.location.reload();
        }}
      >
        <RefreshCw className="size-4" aria-hidden />
        {t("common.retry")}
      </Button>
    </div>
  );
}

// There was no error boundary anywhere in the tree, so any throw during
// render unmounted the whole app into a blank page.
export class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  componentDidMount(): void {
    // Re-arm the one-shot guard only after the page survives its first
    // seconds. location.reload() does not stop the task queue, so clearing
    // immediately would undo the mark this same commit just made (React runs
    // componentDidMount before componentDidCatch) and could loop the tab
    // through reload after every deploy. If the page is still mounted after
    // 5s the chunks loaded and the next deploy deserves an auto-reload again.
    window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        // ignore
      }
    }, 5000);
  }

  componentDidCatch(error: Error): void {
    if (isChunkLoadError(error) && !wasAutoReloaded()) {
      markAutoReload();
      window.location.reload();
      return;
    }
    this.setState({ error });
  }

  render(): ReactNode {
    return this.state.error ? (
      <ChunkFallback error={this.state.error} />
    ) : (
      this.props.children
    );
  }
}

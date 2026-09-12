import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { Button } from "../components/ui/Button";
import { usePageMeta } from "../lib/seo";

export function NotFoundPage() {
  const { t } = useTranslation();
  // Third argument: the SPA rewrite answers every unknown URL with this page,
  // so tell crawlers neither to index nor to canonicalize the random path.
  usePageMeta("notFound.title", "notFound.description", true);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="size-7" aria-hidden />
      </span>
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {t("notFound.error404")}
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        {t("notFound.title")}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {t("notFound.description")}
      </p>
      <Link to="/" className="mt-6">
        <Button>
          <Home className="size-4" aria-hidden />
          {t("notFound.backToDashboard")}
        </Button>
      </Link>
    </div>
  );
}

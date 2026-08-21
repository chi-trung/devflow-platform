import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { Button } from "../components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="size-7" aria-hidden />
      </span>
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Error 404
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        This page drifted off the board
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link to="/" className="mt-6">
        <Button>
          <Home className="size-4" aria-hidden />
          Back to dashboard
        </Button>
      </Link>
    </div>
  );
}

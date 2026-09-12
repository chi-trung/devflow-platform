import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicHeader, PublicFooter } from "../components/landing/PublicChrome";
import { Button } from "../components/ui/Button";
import { usePageMeta } from "../lib/seo";
import { BLOG_POSTS } from "../data/blog";

// Public marketing blog: short engineering notes backed by src/data/blog.ts
// (localized pairs live there, not in the catalogs; marketing-data.test.ts
// gates parity). Layout mirrors ChangelogPage so public pages feel alike.

function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BlogPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("vi") ? "vi" : "en";
  usePageMeta("blog.title", "blog.subtitle");

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground overflow-x-clip">
      <PublicHeader />

      <main className="flex-1">
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[700px] -translate-x-1/2 rounded-full opacity-[0.05] blur-3xl"
            style={{ background: "var(--color-primary)" }}
            aria-hidden
          />
          <div className="mx-auto max-w-4xl px-4 pb-14 pt-16 text-center sm:px-6 sm:pb-16 sm:pt-20">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t("blog.eyebrow")}
            </p>
            <h1 className="mb-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {t("blog.title")}
            </h1>
            <p className="mx-auto max-w-xl text-muted-foreground">
              {t("blog.subtitle")}
            </p>
          </div>
        </section>

        {/* ─── Posts ─── */}
        <article className="border-b border-border py-16 sm:py-20">
          <div className="mx-auto max-w-4xl space-y-16 px-4 sm:px-6">
            {BLOG_POSTS.map((post) => (
              <section key={post.slug} id={post.slug}>
                <time
                  dateTime={post.date}
                  className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
                >
                  {formatDate(post.date, lang)}
                </time>
                <h2 className="mb-4 mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  {post.title[lang]}
                </h2>
                <div className="space-y-4">
                  {post.body.map((paragraph) => (
                    <p
                      key={paragraph.en.slice(0, 40)}
                      className="leading-relaxed text-muted-foreground"
                    >
                      {paragraph[lang]}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>

        {/* ─── CTA ─── */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="mb-6 font-display text-2xl font-semibold tracking-tight">
              {t("blog.ctaTitle")}
            </h2>
            <Link to="/register">
              <Button size="md" className="gap-2 px-8 py-3 text-base">
                {t("landing.ctaButton")}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

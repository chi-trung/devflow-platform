import { useTranslation } from "react-i18next";
import { Check, BookOpen, ExternalLink, KeyRound, MessagesSquare } from "lucide-react";
import {
  PRICING,
  DOCS_CARDS,
  COMMUNITY_CARDS,
  FAQS,
  type DocCard,
} from "../../data/landingContent";
import { SWAGGER_URL, GITHUB_REPO_URL, GITHUB_ISSUES_URL } from "../../data/site";
import { API_BASE } from "../../lib/api";

/**
 * Landing sections the nav and footer point at: #pricing, #docs, #community,
 * #help. Content lives in src/data/landingContent.ts (en/vi pairs, gated by
 * marketing-data.test.ts); every href resolves through site.ts so the links
 * match the real destinations verified against production.
 */

// DocCard.href uses sentinel keys for values that only site.ts may define
// (they depend on API_BASE), and plain paths/anchors for everything else.
function resolveHref(href: string): string {
  switch (href) {
    case "swagger":
      return SWAGGER_URL;
    case "github-repo":
      return GITHUB_REPO_URL;
    case "github-issues":
      return GITHUB_ISSUES_URL;
    default:
      return href;
  }
}

function SectionShell({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-b border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

function CardLink({ card, lang }: { card: DocCard; lang: "en" | "vi" }) {
  const href = resolveHref(card.href);
  const external = card.external;
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary"
    >
      {card.cta[lang]}
      {external ? (
        <ExternalLink
          className="size-3.5 transition-transform duration-150 group-hover:-translate-y-0.5"
          aria-hidden
        />
      ) : (
        <span aria-hidden>→</span>
      )}
    </a>
  );
}

const CARD_ICONS = [BookOpen, KeyRound, Check, MessagesSquare];

function DocCardGrid({ cards }: { cards: DocCard[] }) {
  const lang = useLang();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map((card, i) => {
        const Icon = CARD_ICONS[i % CARD_ICONS.length];
        return (
          <div
            key={card.title.en}
            className="flex flex-col rounded-xl border border-border bg-card/60 p-6 transition-colors duration-200 hover:border-border-strong"
          >
            <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <h3 className="mb-2 font-semibold">{card.title[lang]}</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {card.desc[lang]}
            </p>
            {card.code && (
              <pre className="mb-4 overflow-x-auto rounded-lg bg-elevated p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {card.code.replace(/\$\{apiBase\}/g, API_BASE)}
              </pre>
            )}
            <div className="mt-auto">
              <CardLink card={card} lang={lang} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Small context-free helper: the active marketing locale, "vi" or "en".
function useLang(): "en" | "vi" {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith("vi") ? "vi" : "en";
}

export function PricingSection() {
  const lang = useLang();
  const { t } = useTranslation();
  return (
    <SectionShell id="pricing">
      <div className="mb-12 text-center">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {t("landing.pricing.eyebrow")}
        </p>
        <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("landing.pricing.title")}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {t("landing.pricing.subtitle")}
        </p>
      </div>
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/60 p-8 sm:p-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold">
              {PRICING.planName[lang]}
            </h3>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {PRICING.period[lang]}
            </p>
          </div>
          <p className="font-display text-5xl font-bold text-primary">
            {PRICING.price[lang]}
          </p>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{PRICING.blurb[lang]}</p>
        <ul className="mb-6 space-y-2.5">
          {PRICING.bullets.map((b) => (
            <li key={b.en} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {b[lang]}
            </li>
          ))}
        </ul>
        <p className="rounded-lg bg-elevated p-3 text-xs leading-relaxed text-muted-foreground">
          {PRICING.note[lang]}
        </p>
      </div>
    </SectionShell>
  );
}

export function DocsSection() {
  const { t } = useTranslation();
  return (
    <SectionShell id="docs">
      <div className="mb-12 text-center">
        <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("landing.docs.title")}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {t("landing.docs.subtitle")}
        </p>
      </div>
      <DocCardGrid cards={DOCS_CARDS} />
    </SectionShell>
  );
}

export function CommunitySection() {
  const { t } = useTranslation();
  return (
    <SectionShell id="community">
      <div className="mb-12 text-center">
        <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("landing.community.title")}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {t("landing.community.subtitle")}
        </p>
      </div>
      <DocCardGrid cards={COMMUNITY_CARDS} />
      <p className="mt-8 text-center text-xs text-muted-foreground">
        <a
          href={SWAGGER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {t("landing.community.apiHint")}
        </a>
      </p>
    </SectionShell>
  );
}

export function HelpSection() {
  const lang = useLang();
  const { t } = useTranslation();
  return (
    <SectionShell id="help">
      <div className="mb-12 text-center">
        <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("landing.help.title")}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {t("landing.help.subtitle")}
        </p>
      </div>
      {/* No Accordion primitive in the UI kit; native details/summary gives
          the same disclosure with zero JS and correct keyboard semantics. */}
      <div className="mx-auto max-w-3xl divide-y divide-border rounded-xl border border-border bg-card/60">
        {FAQS.map((faq) => (
          <details key={faq.q.en} className="group px-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
              {faq.q[lang]}
              <span
                className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                aria-hidden
              >
                +
              </span>
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
              {faq.a[lang]}
            </p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t("landing.help.more")}{" "}
        <a
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          {t("landing.help.askIssue")}
        </a>
      </p>
    </SectionShell>
  );
}

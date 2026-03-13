"use client";

import { use } from "react";
import { useLocale } from "@/components/locale-provider";
import { getPageBySlug, getAdjacentPages } from "@/lib/docs-data";
import { PageTransition } from "@/components/motion/page-transition";
import { AnimateIn } from "@/components/motion/animate-in";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

/** Parse inline markdown: **bold**, `code` */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** or `code`
  const regex = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(<strong key={key++} className="text-text font-semibold">{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(
        <code key={key++} className="font-mono text-text bg-bg-elevated px-1.5 py-0.5 rounded text-[12px]">
          {match[2]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

export default function DocSubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { t } = useLocale();

  const page = getPageBySlug(slug);
  if (!page) notFound();

  const { prev, next } = getAdjacentPages(slug);

  // Parse content: split by \n, render paragraphs and code blocks
  const content = t(page.contentKey);
  const sections = content.split("\n\n");

  return (
    <PageTransition>
      <div className="flex gap-0 min-h-[calc(100vh-56px)]">
        <DocsSidebar currentSlug={slug} />

        <main className="flex-1 py-10 px-6 lg:px-12 max-w-[800px]">
          <AnimateIn>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[13px] text-text-muted mb-6">
              <Link href="/docs" className="hover:text-text transition-[color] duration-[--motion-base]">
                Docs
              </Link>
              <span>/</span>
              <span className="text-text-dim">{t(page.categoryTitleKey)}</span>
              <span>/</span>
              <span className="text-text">{t(page.titleKey)}</span>
            </div>

            <h1 className="text-[30px] font-bold tracking-[-0.75px] text-text mb-3">
              {t(page.titleKey)}
            </h1>
            <p className="text-[16px] text-text-dim mb-8 leading-[1.65]">
              {t(page.descKey)}
            </p>
          </AnimateIn>

          <AnimateIn delay={0.1}>
            <div className="prose-custom space-y-5">
              {sections.map((section, i) => {
                // Code block: starts with ```
                if (section.startsWith("```")) {
                  const lines = section.split("\n");
                  const lang = lines[0].replace("```", "").trim();
                  const code = lines.slice(1, -1).join("\n");
                  return (
                    <div
                      key={i}
                      className="rounded-lg bg-[hsl(0_0%_4%)] border border-border p-4 overflow-x-auto"
                    >
                      {lang && (
                        <span className="text-[11px] text-text-muted uppercase tracking-wider block mb-2">
                          {lang}
                        </span>
                      )}
                      <pre className="text-[13px] font-mono text-text-dim leading-[1.7]">
                        <code>{code}</code>
                      </pre>
                    </div>
                  );
                }

                // Heading: starts with ##
                if (section.startsWith("## ")) {
                  return (
                    <h2 key={i} className="text-[20px] font-bold text-text mt-8 mb-2">
                      {section.replace("## ", "")}
                    </h2>
                  );
                }

                if (section.startsWith("### ")) {
                  return (
                    <h3 key={i} className="text-[16px] font-semibold text-text mt-6 mb-2">
                      {section.replace("### ", "")}
                    </h3>
                  );
                }

                // Bullet list
                if (section.startsWith("- ")) {
                  const items = section.split("\n").filter((l) => l.startsWith("- "));
                  return (
                    <ul key={i} className="space-y-2 pl-5">
                      {items.map((item, j) => (
                        <li
                          key={j}
                          className="text-[14px] text-text-dim leading-[1.65] list-disc"
                        >
                          {renderInline(item.replace("- ", ""))}
                        </li>
                      ))}
                    </ul>
                  );
                }

                // Regular paragraph
                return (
                  <p key={i} className="text-[14px] text-text-dim leading-[1.75]">
                    {renderInline(section)}
                  </p>
                );
              })}
            </div>
          </AnimateIn>

          {/* Prev / Next nav */}
          <div className="flex items-center justify-between mt-16 pt-6 border-t border-border">
            {prev ? (
              <Link
                href={`/docs/${prev.slug}`}
                className="flex items-center gap-2 text-[13px] text-text-dim hover:text-text transition-[color] duration-[--motion-base]"
              >
                <ChevronLeft size={16} />
                <div>
                  <span className="text-text-muted block text-[11px]">{t("docs.prev")}</span>
                  {t(prev.titleKey)}
                </div>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link
                href={`/docs/${next.slug}`}
                className="flex items-center gap-2 text-[13px] text-text-dim hover:text-text transition-[color] duration-[--motion-base] text-right"
              >
                <div>
                  <span className="text-text-muted block text-[11px]">{t("docs.next")}</span>
                  {t(next.titleKey)}
                </div>
                <ChevronRight size={16} />
              </Link>
            ) : (
              <div />
            )}
          </div>
        </main>
      </div>
    </PageTransition>
  );
}

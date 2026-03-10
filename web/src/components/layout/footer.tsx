"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

const footerLinkKeys = [
  { key: "GitHub", href: "https://github.com/xiaogong2000/catbus", external: true },
  { labelKey: "nav.docs", href: "/docs", external: false },
  { labelKey: "nav.network", href: "/network", external: false },
];

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-border mt-12 py-8 px-6">
      <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[13px] text-text-muted">
          {t("footer.tagline")}
        </p>
        <div className="flex items-center gap-6">
          {footerLinkKeys.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="text-[13px] text-text-dim hover:text-text transition-[color] duration-[--motion-base]"
            >
              {link.key || t(link.labelKey!)}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

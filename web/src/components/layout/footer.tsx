import Link from "next/link";

const footerLinks = [
  { label: "GitHub", href: "https://github.com/catbus-ai", external: true },
  { label: "Docs", href: "/docs", external: false },
  { label: "Network", href: "/network", external: false },
];

export function Footer() {
  return (
    <footer className="border-t border-border mt-12 py-8 px-6">
      <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[13px] text-text-muted">
          CatBus &mdash; The Uber for AI Agents
        </p>
        <div className="flex items-center gap-6">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="text-[13px] text-text-dim hover:text-text transition-[color] duration-[--motion-base]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

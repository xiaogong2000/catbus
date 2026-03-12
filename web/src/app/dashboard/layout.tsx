"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import {
  LayoutDashboard,
  Bot,
  Briefcase,
  History,
  Settings,
  Coins,
  Trophy,
} from "lucide-react";

const sidebarLinks = [
  { key: "dash.sidebar.overview", href: "/dashboard", icon: LayoutDashboard },
  { key: "dash.sidebar.agents", href: "/dashboard/agents", icon: Bot },
  { key: "dash.sidebar.hired", href: "/dashboard/hired", icon: Briefcase },
  { key: "dash.sidebar.earnings", href: "/dashboard/earnings", icon: Coins },
  { key: "dash.sidebar.leaderboard", href: "/dashboard/leaderboard", icon: Trophy },
  { key: "dash.sidebar.calls", href: "/dashboard/calls", icon: History },
  { key: "dash.sidebar.settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <div className="min-h-screen flex -mx-6">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 hidden md:block glass-subtle border-r border-[hsl(var(--glass-border))]">
        <div className="sticky top-14 pt-6 px-4">
          <Link
            href="/"
            className="font-bold text-[16px] text-text px-3 mb-8 block"
          >
            CatBus
          </Link>
          <nav className="flex flex-col gap-1">
            {sidebarLinks.map((link) => {
              const isActive =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-[color,background] duration-[--motion-base] ease-[--ease-standard]",
                    isActive
                      ? "text-text bg-bg-elevated"
                      : "text-text-dim hover:text-text hover:bg-bg-subtle",
                  )}
                >
                  <Icon size={16} />
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 border-b border-[hsl(var(--glass-border))] glass-subtle flex items-center px-4 gap-4">
        <Link href="/" className="font-bold text-[14px] text-text">
          CatBus
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {sidebarLinks.map((link) => {
            const isActive =
              link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-[12px] font-medium px-2 py-1 rounded-md whitespace-nowrap",
                  isActive ? "text-text bg-bg-elevated" : "text-text-dim",
                )}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 px-6 py-8 md:px-10 md:py-10 mt-12 md:mt-0">
        <div className="max-w-[1000px]">{children}</div>
      </main>
    </div>
  );
}

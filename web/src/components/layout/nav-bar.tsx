"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, LogOut, LayoutDashboard } from "lucide-react";
import { SettingsDropdown } from "@/components/settings-dropdown";
import { useLocale } from "@/components/locale-provider";

const navKeys = [
  { key: "nav.network", href: "/network" },
  { key: "nav.skills", href: "/network/skills" },
  { key: "nav.nodes", href: "/network/nodes" },
  { key: "nav.docs", href: "/docs" },
];

export function NavBar() {
  const { data: session } = useSession();
  const { t } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const close = () => setUserMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [userMenuOpen]);

  const user = session?.user;

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 transition-[background,backdrop-filter,border-color,box-shadow] duration-300 ease-[--ease-standard]",
        scrolled
          ? "glass-subtle border-b border-[hsl(var(--glass-border))]"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="flex items-center justify-between h-14 px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-[16px] font-bold text-text"
          >
            <img src="/catbus-logo.jpg" alt="CatBus" className="w-7 h-7 rounded-full" />
            CatBus
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navKeys.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-2 py-1 text-[13px] font-medium text-text-dim hover:text-text transition-[color] duration-[--motion-base]"
              >
                {t(link.key)}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SettingsDropdown />

          {user ? (
            /* Logged-in: avatar + dropdown */
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                }}
                className="flex items-center gap-2 cursor-pointer rounded-full focus-visible:ring-1 focus-visible:ring-border-hover focus-visible:outline-none"
              >
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="w-7 h-7 rounded-full border border-border"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-[12px] font-semibold text-text">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden md:inline text-[13px] font-medium text-text-dim max-w-[120px] truncate">
                  {user.name || user.email}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-10 w-48 rounded-lg border border-border bg-bg-elevated shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-[13px] font-medium text-text truncate">
                      {user.name || "User"}
                    </p>
                    <p className="text-[11px] text-text-muted truncate">
                      {user.email}
                    </p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-3 py-2 text-[13px] text-text-dim hover:text-text hover:bg-bg-subtle transition-[color,background] duration-[--motion-base]"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <LayoutDashboard size={14} />
                    {t("nav.dashboard")}
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-text-dim hover:text-text hover:bg-bg-subtle transition-[color,background] duration-[--motion-base] cursor-pointer"
                  >
                    <LogOut size={14} />
                    {t("nav.signOut")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Not logged in */
            <Link
              href="/login"
              className="hidden md:inline text-[13px] font-medium text-text border border-border rounded-md px-4 py-1.5 hover:border-border-hover transition-[border-color] duration-[--motion-base]"
            >
              {t("nav.signIn")}
            </Link>
          )}

          <button
            className="md:hidden p-1 text-text-dim hover:text-text transition-[color] duration-[--motion-base] cursor-pointer focus-visible:ring-1 focus-visible:ring-border-hover focus-visible:outline-none rounded-md"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[hsl(var(--glass-border))] px-6 py-4 space-y-3 glass">
          {navKeys.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-2 py-1.5 text-[14px] font-medium text-text-dim hover:text-text transition-[color] duration-[--motion-base]"
            >
              {t(link.key)}
            </Link>
          ))}
          <div className="border-t border-border pt-3 space-y-3">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="block px-2 py-1.5 text-[14px] font-medium text-text-dim hover:text-text transition-[color] duration-[--motion-base]"
                >
                  {t("nav.dashboard")}
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="block w-full text-left px-2 py-1.5 text-[14px] font-medium text-text-dim hover:text-text transition-[color] duration-[--motion-base] cursor-pointer"
                >
                  {t("nav.signOut")}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-2 py-1.5 text-[14px] font-medium text-text border border-border rounded-md text-center hover:border-border-hover transition-[border-color] duration-[--motion-base]"
              >
                {t("nav.signIn")}
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { Locale } from "@/i18n/routing";
import { useScrollDirection } from "@/hooks/use-scroll-direction";

const NAV_ITEMS = [
  { key: "home", href: "/" },
  { key: "menu", href: "/menu" },
  { key: "blog", href: "/blog" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
] as const;

const LOCALE_CONFIG: Record<string, { label: string; ariaLabel: string }> = {
  en: { label: "EN", ariaLabel: "Switch to English" },
  ms: { label: "MY", ariaLabel: "Tukar ke Bahasa Malaysia" },
  zh: { label: "中文", ariaLabel: "切换到中文" },
};

export function Header() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollDirection = useScrollDirection(10);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  function switchLocale(newLocale: string) {
    router.replace(pathname, { locale: newLocale as Locale });
    setMobileOpen(false);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "transition-transform duration-300",
        scrollDirection === "down" ? "-translate-y-full" : "translate-y-0"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo.png"
            alt="Makan Moments Cafe logo"
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
            priority
          />
          <span className="text-xl font-bold text-primary">
            {locale === "zh" ? "食光记忆" : "Makan Moments"}
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === item.href
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/70 hover:text-foreground"
              )}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-md"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 md:hidden">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1 pt-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-md px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
                  pathname === item.href
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
              <ThemeToggle />
              {Object.entries(LOCALE_CONFIG).map(([loc, { label, ariaLabel }]) => (
                <button
                  key={loc}
                  onClick={() => switchLocale(loc)}
                  aria-label={ariaLabel}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors min-h-[44px]",
                    locale === loc
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

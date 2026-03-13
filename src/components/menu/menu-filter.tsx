"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Search, X, Heart, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const speechSupported =
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

const FAV_KEY = "__favorites__";

// IMPORTANT: POS categories are now rendered as NAVIGATION pills (scroll-to anchors), not filters.
// Clicking a POS category pill scrolls to that section in the all-items view, and the pill
// auto-highlights as the user scrolls through that section (activeSection prop from MenuGrid).
// Display categories that are NOT Chef's Picks (e.g., Vegetarian, Under RM15) remain as filter pills.
interface MenuFilterProps {
  // POS categories — rendered as navigation pills (scroll to section)
  categories: string[];
  // Display categories — non-Chef's-Picks ones shown as filter pills
  displayCategories?: string[];
  // Whether to show a Chef's Picks navigation pill (scroll to top section)
  hasChefsPicks?: boolean;
  // Currently visible section from scroll detection (null = above all sections, "__chefs__" = Chef's Picks)
  activeSection: string | null;
  // Called when a navigation pill is clicked (null = scroll to top)
  onScrollToSection: (cat: string | null) => void;
  // Active filter (null = all sections, "__dc__Vegetarian" = vegetarian, "__favorites__" = favs)
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  itemCount: number;
  servingNowCategories?: string[];
  favoritesCount?: number;
}

export function MenuFilter({
  categories,
  displayCategories = [],
  hasChefsPicks = false,
  activeSection,
  onScrollToSection,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  itemCount,
  favoritesCount = 0,
}: MenuFilterProps) {
  const t = useTranslations("menu");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [isListening, setIsListening] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  // Search bar open on mobile — auto-open if there's already a query (e.g. from URL ?q=)
  const [searchOpen, setSearchOpen] = useState(() => !!searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reveal mic after hydration to avoid SSR mismatch
  useEffect(() => { setVoiceReady(speechSupported); }, []);

  // Focus search input when it opens
  useEffect(() => {
    if (searchOpen) {
      // Small delay so the expand animation completes first
      const t = setTimeout(() => searchInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  // Auto-scroll the pills bar to keep the active pill in view.
  // Uses manual scrollLeft instead of scrollIntoView to avoid interfering with
  // any ongoing page-level smooth scroll (e.g. scrolling to a category section).
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector('[data-active="true"]') as HTMLElement | null;
    if (!activeBtn) return;
    const btnLeft = activeBtn.offsetLeft;
    const btnRight = btnLeft + activeBtn.offsetWidth;
    const visibleLeft = container.scrollLeft;
    const visibleRight = visibleLeft + container.clientWidth;
    if (btnLeft < visibleLeft) {
      container.scrollTo({ left: btnLeft - 8, behavior: "smooth" });
    } else if (btnRight > visibleRight) {
      container.scrollTo({ left: btnRight - container.clientWidth + 8, behavior: "smooth" });
    }
  }, [activeSection, selectedCategory]);

  function toggleVoice() {
    if (!speechSupported) return;
    try {
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Win = window as any;
      const SpeechRecognitionCtor = Win.SpeechRecognition || Win.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = locale === "zh" ? "zh-CN" : locale === "ms" ? "ms-MY" : "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;

      const session = { transcript: "" };

      recognition.onstart = () => setIsListening(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        session.transcript = text;
        onSearchChange(text);
      };
      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };
      recognition.onerror = () => {
        setIsListening(false);
        recognitionRef.current = null;
        session.transcript = "";
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }

  const isFilterActive = !!selectedCategory;

  // Display categories that are NOT Chef's Picks → shown as filter pills
  const filterDisplayCats = displayCategories.filter(
    (dc) => !dc.toLowerCase().includes("chef")
  );

  function handleNavPillClick(cat: string | null) {
    if (isFilterActive) onCategoryChange(null); // clear any active filter first
    onScrollToSection(cat);
  }

  const pillBase =
    "flex-shrink-0 snap-start rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 min-h-[44px] flex items-center";
  const pillActive = "bg-primary text-primary-foreground scale-[1.04]";
  const pillInactive = "bg-secondary text-secondary-foreground hover:bg-secondary/80";

  return (
    <div
      className={cn(
        // Mobile: sticky top bar below site header — always visible for navigation
        "sticky top-16 left-0 right-0 z-40",
        "border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80",
        "px-4",
        // Desktop: always visible, non-sticky
        "md:relative md:top-auto",
        "md:border-0 md:bg-transparent md:backdrop-blur-none",
        "md:px-0 md:pb-0 md:mb-6 md:space-y-4"
      )}
      style={{ paddingBottom: "0.5rem" }}
    >
      {/* Search bar — hidden on mobile until toggled; always visible on desktop */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          searchOpen ? "max-h-16 opacity-100 pt-2 pb-2" : "max-h-0 opacity-0 pt-0 pb-0",
          "md:max-h-none md:opacity-100 md:pt-0 md:pb-0"
        )}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchInputRef}
            id="menu-search"
            name="menu-search"
            type="text"
            placeholder={isListening ? t("listening") : t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-input bg-background py-2.5 pl-10 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary",
              (voiceReady || searchQuery) ? "pr-16" : "pr-4"
            )}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => { onSearchChange(""); setSearchOpen(false); }}
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {voiceReady && (
              <button
                type="button"
                onClick={toggleVoice}
                className={cn(
                  "rounded-full p-1.5 transition-colors",
                  isListening
                    ? "animate-pulse text-red-500"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={isListening ? "Stop voice search" : "Voice search"}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category pills row + search toggle icon (mobile) */}
      <div className="flex items-center gap-2 py-2">
        {/* Scrollable pills */}
        <div
          ref={scrollContainerRef}
          className="flex flex-nowrap items-center gap-2 overflow-x-auto flex-1 min-w-0 pb-0.5 scrollbar-hide snap-x snap-mandatory md:flex-wrap md:overflow-visible md:snap-none"
        >
          {/* All — scroll to top */}
          <button
            onClick={() => handleNavPillClick(null)}
            data-active={(!isFilterActive && activeSection === null) ? "true" : "false"}
            className={cn(pillBase, !isFilterActive && activeSection === null ? pillActive : pillInactive)}
          >
            {tc("allCategories")}
          </button>

          {/* Chef's Picks — scroll to Chef's Picks section */}
          {hasChefsPicks && (
            <button
              onClick={() => handleNavPillClick("__chefs__")}
              data-active={(!isFilterActive && activeSection === "__chefs__") ? "true" : "false"}
              className={cn(pillBase, !isFilterActive && activeSection === "__chefs__" ? pillActive : pillInactive)}
            >
              ★ Chef&apos;s Picks
            </button>
          )}

          {/* POS category navigation pills */}
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleNavPillClick(cat)}
              data-active={(!isFilterActive && activeSection === cat) ? "true" : "false"}
              className={cn(pillBase, !isFilterActive && activeSection === cat ? pillActive : pillInactive)}
            >
              {cat}
            </button>
          ))}

          {/* Display category filter pills (Vegetarian, Under RM15, etc.) — not Chef's Picks */}
          {filterDisplayCats.map((dc) => {
            const filterKey = `__dc__${dc}`;
            return (
              <button
                key={filterKey}
                onClick={() =>
                  selectedCategory === filterKey
                    ? onCategoryChange(null)
                    : onCategoryChange(filterKey)
                }
                data-active={selectedCategory === filterKey ? "true" : "false"}
                className={cn(pillBase, selectedCategory === filterKey ? pillActive : pillInactive)}
              >
                {dc}
              </button>
            );
          })}

          {/* Favorites filter pill */}
          {favoritesCount > 0 && (
            <button
              onClick={() =>
                selectedCategory === FAV_KEY
                  ? onCategoryChange(null)
                  : onCategoryChange(FAV_KEY)
              }
              data-active={selectedCategory === FAV_KEY ? "true" : "false"}
              className={cn(
                "flex-shrink-0 snap-start inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 min-h-[44px]",
                selectedCategory === FAV_KEY
                  ? "bg-red-500 text-white scale-[1.04]"
                  : "border border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
              )}
            >
              <Heart className={cn("h-3.5 w-3.5", selectedCategory === FAV_KEY ? "fill-white text-white" : "fill-red-400 text-red-400")} />
              {tc("favorites")}
              <span className="rounded-full bg-current/20 px-1.5 py-0 text-xs">{favoritesCount}</span>
            </button>
          )}

          {/* Allergen-free filter — shows active badge or a compact select */}
          {onAllergenFreeChange && (
            <div className="flex-shrink-0 snap-start">
              {allergenFree ? (
                <button
                  type="button"
                  onClick={() => onAllergenFreeChange(null)}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium min-h-[44px] bg-purple-500 text-white scale-[1.04] transition-all"
                >
                  {ta("filterFreeOf", { allergen: ta(allergenFree as "nuts" | "shellfish" | "dairy" | "eggs" | "gluten" | "soy") })}
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <select
                  value=""
                  onChange={(e) => onAllergenFreeChange(e.target.value || null)}
                  className={cn(pillBase, pillInactive, "cursor-pointer appearance-none")}
                  aria-label={ta("allergenFilter")}
                >
                  <option value="">{ta("allergenFilter")}</option>
                  {ALLERGEN_SLUGS.map((slug) => (
                    <option key={slug} value={slug}>{ta(slug)}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Search toggle button — mobile only; shows "Search" text when idle for discoverability */}
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className={cn(
            "flex-shrink-0 flex items-center gap-1.5 rounded-full transition-colors md:hidden",
            searchOpen || searchQuery
              ? "p-2.5 bg-primary text-primary-foreground"
              : "px-3 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
          aria-label={searchOpen ? "Close search" : "Search dishes"}
        >
          {searchOpen && !searchQuery ? (
            <X className="h-4 w-4" />
          ) : searchQuery ? (
            <Search className="h-4 w-4" />
          ) : (
            <>
              <Search className="h-3.5 w-3.5" />
              <span className="text-sm font-medium">{tc("search")}</span>
            </>
          )}
        </button>
      </div>

      {/* Count — all screen sizes */}
      <p className="text-sm text-muted-foreground">
        {t("itemsCount", { count: itemCount })}
      </p>
    </div>
  );
}

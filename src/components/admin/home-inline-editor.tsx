"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Check, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { MenuItem } from "@/types/menu";
import { HeroDishCard } from "@/components/home/hero-dish-card";
import { MenuCard } from "@/components/menu/menu-card";
import { HERO_BLUR } from "@/data/hero-blur";
import { cn } from "@/lib/utils";

export interface HomeContent {
  heroTitle: string;
  heroTagline: string;
  heroSubtitle: string;
  highlightsTitle: string;
  highlightsSubtitle: string;
}

interface HomeInlineEditorProps {
  content: HomeContent;
  featuredItems: MenuItem[];
  signatureDish?: MenuItem | null;
}

// ── Per-field inline editable text ──────────────────────────────────────────
interface InlineFieldProps {
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  /** className applied to the read-mode span */
  displayClassName?: string;
  /** className applied to the input/textarea */
  inputClassName?: string;
  placeholder?: string;
}

function InlineField({ value, onSave, multiline = false, displayClassName, inputClassName, placeholder }: InlineFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  }

  function startEdit() {
    setDraft(value);
    setIsEditing(true);
  }

  if (isEditing) {
    return multiline ? (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setDraft(value); setIsEditing(false); }
        }}
        rows={3}
        className={cn(
          "w-full rounded-lg border-2 border-amber-400 bg-background px-3 py-2 outline-none focus:ring-1 focus:ring-amber-400",
          inputClassName
        )}
        placeholder={placeholder}
      />
    ) : (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") { setDraft(value); setIsEditing(false); }
        }}
        className={cn(
          "w-full rounded-lg border-2 border-amber-400 bg-background px-3 py-2 outline-none focus:ring-1 focus:ring-amber-400",
          inputClassName
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={startEdit}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && startEdit()}
      className={cn(
        "cursor-text rounded border-b-2 border-transparent transition-colors hover:border-amber-400/60 focus:border-amber-400 focus:outline-none",
        displayClassName
      )}
      title="Click to edit"
    >
      {value}
      {saving && <Loader2 className="ml-1 inline h-3 w-3 animate-spin text-amber-500" />}
      {saved && !saving && <Check className="ml-1 inline h-3 w-3 text-green-500" />}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function HomeInlineEditor({ content, featuredItems, signatureDish }: HomeInlineEditorProps) {
  const router = useRouter();
  const heroFileRef = useRef<HTMLInputElement>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [heroSuccessMsg, setHeroSuccessMsg] = useState<string | null>(null);

  // Save a single field to the backend
  async function saveField(key: keyof HomeContent, value: string) {
    const res = await fetch("/api/admin/content/home", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...content, [key]: value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || "Failed to save");
    }
    router.refresh();
  }

  async function handleHeroImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !signatureDish) return;
    setHeroUploading(true);
    setHeroError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("code", signatureDish.code);
      const res = await fetch("/api/admin/images", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Upload failed");
      }
      setHeroSuccessMsg("Hero image updated");
      setTimeout(() => setHeroSuccessMsg(null), 3000);
      router.refresh();
    } catch (err) {
      setHeroError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setHeroUploading(false);
      if (heroFileRef.current) heroFileRef.current.value = "";
    }
  }

  return (
    <div>
      {/* Small admin hint bar — not the full sticky banner */}
      <div className="flex items-center gap-2 border-b border-amber-200/60 bg-amber-50/80 px-4 py-2 text-xs text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-400">
        <span className="font-semibold">Admin view</span>
        <span className="text-amber-500">·</span>
        <span>Click any text to edit in-place. Saves automatically on blur.</span>
        <Link href="/admin" className="ml-auto rounded bg-amber-100 px-2 py-0.5 font-medium hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60">
          Admin Panel →
        </Link>
      </div>

      {/* Hero section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/8 via-background to-accent/15">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-16">
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">

            {/* Mobile hero image — with "Change Photo" overlay */}
            <div className="lg:hidden">
              <div className="relative">
                <HeroDishCard
                  item={signatureDish ?? null}
                  className="aspect-[4/3] shadow-2xl"
                  sizes="100vw"
                  priority
                  fallbackBlurDataURL={HERO_BLUR.heroMobile}
                />
                {/* Hidden file input */}
                <input
                  ref={heroFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleHeroImageUpload}
                />
                {/* Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 rounded-2xl pb-4 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
                  {signatureDish ? (
                    <button
                      type="button"
                      onClick={() => heroFileRef.current?.click()}
                      disabled={heroUploading}
                      className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-50"
                    >
                      {heroUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      Change Hero Photo
                    </button>
                  ) : (
                    <Link
                      href="/menu"
                      className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      ⭐ Select a Hero Dish →
                    </Link>
                  )}
                </div>
                {heroSuccessMsg && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center rounded-b-2xl bg-green-600/90 py-2 text-sm font-medium text-white">
                    <Check className="mr-1.5 h-3.5 w-3.5" /> {heroSuccessMsg}
                  </div>
                )}
                {heroError && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between rounded-b-2xl bg-red-600/90 px-3 py-2 text-sm font-medium text-white">
                    <span>{heroError}</span>
                    <button type="button" onClick={() => setHeroError(null)}><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
            </div>

            {/* Text content — all fields are inline-editable */}
            <div>
              <div className="mb-4">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Hero Title <span className="text-amber-500">(click to edit)</span>
                </p>
                <InlineField
                  value={content.heroTitle}
                  onSave={(v) => saveField("heroTitle", v)}
                  displayClassName="block font-display text-4xl font-bold tracking-tight text-primary sm:text-6xl"
                  inputClassName="font-display text-4xl font-bold text-primary"
                />
              </div>

              <div className="mb-3">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Tagline (italic)
                </p>
                <InlineField
                  value={content.heroTagline}
                  onSave={(v) => saveField("heroTagline", v)}
                  displayClassName="block font-display text-base italic text-primary/75 sm:text-lg"
                  inputClassName="font-display text-lg italic text-primary/75"
                />
              </div>

              <div className="mb-3">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Description
                </p>
                <InlineField
                  value={content.heroSubtitle}
                  onSave={(v) => saveField("heroSubtitle", v)}
                  multiline
                  displayClassName="block text-sm leading-6 text-muted-foreground sm:text-base"
                  inputClassName="text-base leading-6 text-muted-foreground"
                />
              </div>
            </div>

            {/* Desktop hero image — with "Change Photo" overlay */}
            <div className="relative hidden w-full lg:block lg:pl-8">
              <HeroDishCard
                item={signatureDish ?? null}
                className="aspect-[4/3] shadow-xl"
                sizes="(max-width: 1024px) 50vw, 800px"
                priority
                fallbackBlurDataURL={HERO_BLUR.heroMobile}
              />
              {/* Hover overlay for desktop */}
              <div className="absolute inset-0 lg:pl-8">
                <div className="relative h-full w-full">
                  <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 rounded-2xl pb-4 opacity-0 transition-opacity hover:opacity-100">
                    {signatureDish ? (
                      <button
                        type="button"
                        onClick={() => heroFileRef.current?.click()}
                        disabled={heroUploading}
                        className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white hover:bg-black/90 disabled:opacity-50"
                      >
                        {heroUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        Change Hero Photo
                      </button>
                    ) : (
                      <Link
                        href="/menu"
                        className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                      >
                        ⭐ Select a Hero Dish on Menu →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights section */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8">
          <div className="mb-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Highlights Title
            </p>
            <InlineField
              value={content.highlightsTitle}
              onSave={(v) => saveField("highlightsTitle", v)}
              displayClassName="block font-display text-3xl font-bold"
              inputClassName="font-display text-3xl font-bold"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Highlights Subtitle
            </p>
            <InlineField
              value={content.highlightsSubtitle}
              onSave={(v) => saveField("highlightsSubtitle", v)}
              displayClassName="block text-muted-foreground"
              inputClassName="text-muted-foreground"
            />
          </div>
        </div>

        {featuredItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {featuredItems.slice(0, 6).map((item) => (
              <MenuCard key={item.id} item={item} isAdmin />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            No featured items — toggle the Featured flag on items in Admin → Menu.
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Manage featured items in Admin → Menu → toggle the Featured flag on any item.
        </p>
      </section>
    </div>
  );
}

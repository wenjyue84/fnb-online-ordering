"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { EditableItem } from "@/hooks/useMenuTableEdit";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DIETARY_OPTIONS = ["Spicy", "Vegetarian", "Vegan", "Gluten Free"];
const ALLERGEN_OPTIONS = ["nuts", "shellfish", "dairy", "eggs", "gluten", "soy"];
const ALLERGEN_EMOJI: Record<string, string> = { nuts: "🥜", shellfish: "🦐", dairy: "🥛", eggs: "🥚", gluten: "🌾", soy: "🫘" };

interface AdminMenuTableRowProps {
  item: EditableItem;
  imgVersion: number;
  highlightedCode: string | null;
  saving: string | null;
  suggesting: Record<string, boolean>;
  onImageClick: (code: string) => void;
  onUpdate: (id: string, patch: Partial<EditableItem>) => void;
  onSave: (item: EditableItem) => void;
  onDelete: (id: string) => void;
  onToggleDay: (item: EditableItem, day: string) => void;
  onToggleDietary: (item: EditableItem, d: string) => void;
  onToggleAllergen: (item: EditableItem, allergen: string) => void;
  onSuggestTranslation: (item: EditableItem, lang: "ms" | "zh") => void;
  onToggleAvailable: (id: string) => void;
  variant: "desktop" | "mobile";
}

export function AdminMenuTableRow({
  item,
  imgVersion,
  highlightedCode,
  saving,
  suggesting,
  onImageClick,
  onUpdate,
  onSave,
  onDelete,
  onToggleDay,
  onToggleDietary,
  onToggleAllergen,
  onToggleAvailable,
  onSuggestTranslation,
  variant,
}: AdminMenuTableRowProps) {
  const rowBg = cn(
    highlightedCode === item.code
      ? "ring-2 ring-amber-400 bg-amber-50"
      : item.disabledByRule
        ? "bg-red-50/60"
        : item._dirty
          ? "bg-amber-50"
          : "bg-white"
  );

  const imageButton = (size: "sm" | "lg") => (
    <button
      onClick={() => item.code && onImageClick(item.code)}
      disabled={!item.code}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50",
        size === "sm"
          ? "h-12 w-16 hover:border-orange-400 hover:shadow-sm transition-all"
          : "h-16 w-20 shrink-0"
      )}
      title={item.code ? `Change image for ${item.code}` : "Set code first"}
    >
      {item.code && (
        <Image
          src={`${item.photo ?? `/images/menu/${item.code}.jpg`}?v=${imgVersion}`}
          alt={item.code}
          fill
          className="object-cover"
          sizes={size === "sm" ? "64px" : "80px"}
          unoptimized
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      {size === "sm" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent group-hover:bg-black/40 group-hover:text-white transition-all text-[10px] font-medium">
          {item.code ? "Edit" : "—"}
        </span>
      )}
    </button>
  );

  const availableToggle = (size: "sm" | "lg") => (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={() => item._new ? onUpdate(item.id, { available: !item.available }) : onToggleAvailable(item.id)}
        className={cn(
          "rounded-full transition-colors",
          size === "sm" ? "h-6 w-10" : "h-7 w-12",
          item.available ? "bg-green-500" : "bg-gray-300"
        )}
        aria-label={item.available ? "Mark as sold out" : "Mark as available"}
      >
        <span
          className={cn(
            "block rounded-full bg-white shadow transition-transform",
            size === "sm" ? "h-5 w-5 translate-x-0.5" : "h-5 w-5 translate-x-1",
            item.available && (size === "sm" ? "translate-x-4" : "translate-x-6")
          )}
        />
      </button>
      {!item.available && (
        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 whitespace-nowrap">
          Sold Out
        </span>
      )}
    </div>
  );

  const actionsButtons = (fullWidth: boolean) => (
    <div className={cn("flex gap-1", fullWidth ? "mt-3" : "flex-col")}>
      <button
        onClick={() => onSave(item)}
        disabled={saving === item.id || !item._dirty}
        className={cn(
          "rounded bg-orange-500 font-medium text-white hover:bg-orange-600 disabled:opacity-40",
          fullWidth
            ? "min-h-[44px] flex-1 rounded-lg text-sm"
            : "px-2 py-1 text-xs"
        )}
      >
        {saving === item.id ? (fullWidth ? "Saving…" : "…") : "Save"}
      </button>
      <button
        onClick={() => onDelete(item.id)}
        className={cn(
          "font-medium text-red-600",
          fullWidth
            ? "min-h-[44px] min-w-[44px] rounded-lg border border-red-200 px-3 text-sm hover:bg-red-50"
            : "rounded bg-red-50 px-2 py-1 text-xs hover:bg-red-100"
        )}
      >
        Del
      </button>
    </div>
  );

  if (variant === "mobile") {
    return (
      <div
        id={item.code ? `menu-row-${item.code}` : undefined}
        className={cn("rounded-xl border p-4", rowBg)}
      >
        <div className="flex gap-3">
          {imageButton("lg")}

          <div className="min-w-0 flex-1 space-y-1.5">
            <input
              value={item.code}
              onChange={(e) => onUpdate(item.id, { code: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="CODE"
            />
            <div className="flex items-center gap-1">
              <input
                value={item.nameEn}
                onChange={(e) => onUpdate(item.id, { nameEn: e.target.value })}
                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="English name"
              />
              <span title="Missing translations" className="shrink-0 text-sm">🌐</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                value={item.nameMs}
                onChange={(e) => onUpdate(item.id, { nameMs: e.target.value })}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                placeholder="Malay name"
              />
              <button
                onClick={() => onSuggestTranslation(item, "ms")}
                disabled={!item.nameEn || suggesting[`${item.id}-ms`]}
                className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-1 text-xs text-blue-600 hover:bg-blue-100 disabled:opacity-40"
                title="Suggest Malay translation"
              >
                {suggesting[`${item.id}-ms`] ? "…" : "✨"}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <input
                value={item.nameZh}
                onChange={(e) => onUpdate(item.id, { nameZh: e.target.value })}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                placeholder="Chinese name"
              />
              <button
                onClick={() => onSuggestTranslation(item, "zh")}
                disabled={!item.nameEn || suggesting[`${item.id}-zh`]}
                className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-1 text-xs text-blue-600 hover:bg-blue-100 disabled:opacity-40"
                title="Suggest Chinese translation"
              >
                {suggesting[`${item.id}-zh`] ? "…" : "✨"}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">RM</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={item.originalPrice ?? item.price}
                onChange={(e) =>
                  onUpdate(item.id, { price: parseFloat(e.target.value) || 0 })
                }
                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2">
            {availableToggle("lg")}
            <button
              onClick={() => onUpdate(item.id, { featured: !item.featured })}
              className={cn("text-xl leading-none", item.featured ? "text-yellow-400" : "text-gray-300")}
              aria-label="Toggle featured"
            >
              ★
            </button>
          </div>
        </div>

        {actionsButtons(true)}
      </div>
    );
  }

  // Desktop: renders a <tr> for use inside <tbody>
  return (
    <tr
      id={item.code ? `menu-row-${item.code}` : undefined}
      className={cn("align-top", rowBg)}
    >
      <td className="px-3 py-2">{imageButton("sm")}</td>

      <td className="px-3 py-2">
        <input
          value={item.code}
          onChange={(e) => onUpdate(item.id, { code: e.target.value })}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
          placeholder="CODE"
        />
      </td>

      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <input
              value={item.nameEn}
              onChange={(e) => onUpdate(item.id, { nameEn: e.target.value })}
              className="w-40 rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="English"
            />
            <span title="Missing translations" className="shrink-0 text-sm">🌐</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              value={item.nameMs}
              onChange={(e) => onUpdate(item.id, { nameMs: e.target.value })}
              className="w-36 rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="Melayu"
            />
            <button
              onClick={() => onSuggestTranslation(item, "ms")}
              disabled={!item.nameEn || suggesting[`${item.id}-ms`]}
              className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-1 text-xs text-blue-600 hover:bg-blue-100 disabled:opacity-40"
              title="Suggest Malay translation"
            >
              {suggesting[`${item.id}-ms`] ? "…" : "✨"}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <input
              value={item.nameZh}
              onChange={(e) => onUpdate(item.id, { nameZh: e.target.value })}
              className="w-36 rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="中文"
            />
            <button
              onClick={() => onSuggestTranslation(item, "zh")}
              disabled={!item.nameEn || suggesting[`${item.id}-zh`]}
              className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-1 text-xs text-blue-600 hover:bg-blue-100 disabled:opacity-40"
              title="Suggest Chinese translation"
            >
              {suggesting[`${item.id}-zh`] ? "…" : "✨"}
            </button>
          </div>
        </div>
      </td>

      <td className="px-3 py-2">
        <input
          type="number"
          step="0.1"
          min="0"
          value={item.originalPrice ?? item.price}
          onChange={(e) =>
            onUpdate(item.id, { price: parseFloat(e.target.value) || 0 })
          }
          className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        {item.discountPercent && item.discountPercent > 0 && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-xs text-gray-400 line-through">
              RM{(item.originalPrice ?? item.price).toFixed(2)}
            </span>
            <span className="text-xs font-medium text-green-700">
              RM{item.price.toFixed(2)}
            </span>
            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
              -{item.discountPercent}%
            </span>
          </div>
        )}
      </td>

      <td className="px-3 py-2">
        {availableToggle("sm")}
        {item.disabledByRule && (
          <span
            className="group relative mt-0.5 inline-block cursor-default rounded-full bg-red-100 px-1.5 py-0.5 text-center text-[10px] font-medium text-red-700 whitespace-nowrap"
          >
            Rules
            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {item.appliedRules?.filter((r) => r.ruleType === "disable").map((r) => r.ruleName).join(", ") ?? "rule"}
            </span>
          </span>
        )}
      </td>

      <td className="px-3 py-2">
        <button
          onClick={() => onUpdate(item.id, { featured: !item.featured })}
          className={cn("text-xl", item.featured ? "text-yellow-400" : "text-gray-300")}
        >
          ★
        </button>
        {item.featuredByRule && (
          <span className="mt-0.5 block rounded-full bg-amber-100 px-1.5 py-0.5 text-center text-[10px] font-medium text-amber-700">
            Rule
          </span>
        )}
      </td>

      <td className="px-3 py-2">
        <div className="relative group">
          <button className="rounded border border-gray-300 px-2 py-1 text-xs">
            {item.dietary.length > 0 ? item.dietary.join(", ") : "None"}
          </button>
          <div className="absolute left-0 top-8 z-10 hidden w-40 rounded-lg border bg-white p-2 shadow-lg group-focus-within:block group-hover:block">
            {DIETARY_OPTIONS.map((d) => (
              <label key={d} className="flex items-center gap-1.5 py-0.5 text-xs cursor-pointer hover:bg-gray-50 rounded px-1">
                <input
                  type="checkbox"
                  checked={item.dietary.includes(d)}
                  onChange={() => onToggleDietary(item, d)}
                />
                {d}
              </label>
            ))}
          </div>
        </div>
      </td>

      <td className="px-3 py-2">
        <div className="relative group">
          <button className="rounded border border-gray-300 px-2 py-1 text-xs">
            {(item.allergens ?? []).length > 0
              ? (item.allergens ?? []).map((a) => `${ALLERGEN_EMOJI[a] ?? ""} ${a}`).join(", ")
              : "None"}
          </button>
          <div className="absolute left-0 top-8 z-10 hidden w-44 rounded-lg border bg-white p-2 shadow-lg group-focus-within:block group-hover:block">
            {ALLERGEN_OPTIONS.map((a) => (
              <label key={a} className="flex items-center gap-1.5 py-0.5 text-xs cursor-pointer hover:bg-gray-50 rounded px-1">
                <input
                  type="checkbox"
                  checked={(item.allergens ?? []).includes(a)}
                  onChange={() => onToggleAllergen(item, a)}
                />
                <span>{ALLERGEN_EMOJI[a]}</span> {a}
              </label>
            ))}
          </div>
        </div>
      </td>

      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-0.5">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => onToggleDay(item, day)}
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                item.availableDays.includes(day)
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {day.slice(0, 2)}
            </button>
          ))}
        </div>
      </td>

      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <input
            type="time"
            value={item.timeFrom}
            onChange={(e) => onUpdate(item.id, { timeFrom: e.target.value })}
            className="rounded border border-gray-300 px-1 py-0.5 text-xs"
          />
          <input
            type="time"
            value={item.timeUntil}
            onChange={(e) => onUpdate(item.id, { timeUntil: e.target.value })}
            className="rounded border border-gray-300 px-1 py-0.5 text-xs"
          />
        </div>
      </td>

      <td className="px-3 py-2">
        <input
          value={item.specialDates.join(",")}
          onChange={(e) =>
            onUpdate(item.id, {
              specialDates: e.target.value
                .split(",")
                .map((d) => d.trim())
                .filter(Boolean),
            })
          }
          className="w-28 rounded border border-gray-300 px-2 py-1 text-xs"
          placeholder="YYYY-MM-DD"
        />
      </td>

      <td className="px-3 py-2">
        <input
          type="number"
          value={item.sortOrder}
          onChange={(e) =>
            onUpdate(item.id, { sortOrder: parseInt(e.target.value) || 0 })
          }
          className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
        />
      </td>

      <td className="px-3 py-2">
        {actionsButtons(false)}
      </td>
    </tr>
  );
}

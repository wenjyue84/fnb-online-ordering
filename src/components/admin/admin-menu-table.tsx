"use client";

import { Fragment, useState, useEffect } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { useMenuTableEdit, type EditableItem } from "@/hooks/useMenuTableEdit";
import { AdminMenuTableRow } from "./admin-menu-table-row";
import { ImagePickerModal } from "./image-picker-modal";
import type { MenuItemWithRules } from "@/types/menu";

const MISSING_PHOTOS_DISMISSED_KEY = "admin_missing_photos_dismissed";

const COLUMN_TOOLTIPS: Record<string, string> = {
  IMAGE: "Item photo — click the image in a row to upload a new one",
  CODE: "POS item code (read-only) — used to match photos and rules",
  NAME: "Item name in English, Malay, and Chinese — all 3 are shown on the menu",
  PRICE: "Selling price in RM — displayed on the public menu",
  ON: "Toggle item visibility on the public menu (on/off switch)",
  STAR: "Featured — marks item for the homepage highlights section",
  DIETARY: "Dietary tags shown to customers (Spicy, Vegetarian, Vegan, Gluten Free)",
  ALLERGENS: "Allergen tags (Nuts, Shellfish, Dairy, Eggs, Gluten, Soy) — shown as icon badges on menu",
  DAYS: "Days of week this item is available (e.g., Mon-Fri only)",
  TIME: "Time window this item is served (e.g., 11:00-15:00)",
  DATES: "Special dates this item is available or unavailable",
  SORT: "Display order within its category — lower number appears first",
};

interface AdminMenuTableProps {
  initialItems: MenuItemWithRules[];
  displayCategories?: string[];
}

function filterByDisplayCat(item: EditableItem, dc: string): boolean {
  const lc = dc.toLowerCase();
  if (lc.includes("rm15"))
    return item.price < 15 && !item.displayCategories.some((d) => d === "Hot Drinks" || d === "Cold Drinks & Juice");
  if (lc.includes("vegetarian"))
    return item.dietary?.some((d) => d.toLowerCase() === "vegetarian") ?? false;
  return item.displayCategories.includes(dc);
}

function groupByDisplayCategory(
  items: EditableItem[],
  displayCategories: string[]
): { cat: string; label: string; items: EditableItem[] }[] {
  const catMap = new Map<string, EditableItem[]>();
  for (const dc of displayCategories) catMap.set(dc, []);
  catMap.set("__none__", []);

  for (const item of items) {
    const primaryDC = item.displayCategories[0] ?? "__none__";
    if (!catMap.has(primaryDC)) catMap.set(primaryDC, []);
    catMap.get(primaryDC)!.push(item);
  }

  return [...catMap.entries()]
    .map(([cat, catItems]) => ({
      cat,
      label: cat === "__none__" ? "Uncategorized" : cat,
      items: catItems,
    }))
    .filter(({ cat: c, items: i }) => i.length > 0 || displayCategories.includes(c));
}

export function AdminMenuTable({
  initialItems,
  displayCategories = [],
}: AdminMenuTableProps) {
  const {
    items,
    saving,
    error,
    suggesting,
    imgVersion,
    imagePickerCode,
    setImagePickerCode,
    handleImageChange,
    updateItem,
    addNewRow,
    saveItem,
    deleteItem,
    toggleDay,
    toggleDietary,
    toggleAllergen,
    suggestTranslation,
    toggleAvailable,
    restoreAll,
  } = useMenuTableEdit(initialItems);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [missingPhotos, setMissingPhotos] = useState<{ id: string; code: string; nameEn: string }[]>([]);
  const [photoAlertDismissed, setPhotoAlertDismissed] = useState(false);
  const [isAlertExpanded, setIsAlertExpanded] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const dismissed = sessionStorage.getItem(MISSING_PHOTOS_DISMISSED_KEY);
    if (dismissed) { setPhotoAlertDismissed(true); return; }
    fetch("/api/admin/menu/missing-photos")
      .then((r) => r.json())
      .then((data) => setMissingPhotos(data))
      .catch(() => {});
  }, []);

  function dismissPhotoAlert() {
    sessionStorage.setItem(MISSING_PHOTOS_DISMISSED_KEY, "1");
    setPhotoAlertDismissed(true);
  }

  function scrollToItem(code: string) {
    setHighlightedCode(code);
    const el = document.getElementById(`menu-row-${code}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightedCode(null), 2000);
    }
  }

  const searchedItems =
    search === ""
      ? items
      : items.filter((item) =>
          [item.code, item.nameEn, item.nameMs, item.nameZh].some((v) =>
            v?.toLowerCase().includes(search.toLowerCase())
          )
        );

  const filteredItems = activeCategory
    ? searchedItems.filter((i) => filterByDisplayCat(i, activeCategory))
    : searchedItems;

  const groupedItems = groupByDisplayCategory(searchedItems, displayCategories);

  const soldOutCount = items.filter((i) => !i.available).length;
  const [restoring, setRestoring] = useState(false);
  const [restoreToast, setRestoreToast] = useState<string | null>(null);

  async function handleRestoreAll() {
    if (!confirm(`Restore all ${soldOutCount} sold-out items to available?`)) return;
    setRestoring(true);
    const count = await restoreAll();
    setRestoring(false);
    setRestoreToast(`${count} item${count !== 1 ? "s" : ""} restored`);
    setTimeout(() => setRestoreToast(null), 3000);
  }

  const rowProps = {
    imgVersion,
    highlightedCode,
    saving,
    suggesting,
    onImageClick: setImagePickerCode,
    onUpdate: updateItem,
    onSave: saveItem,
    onDelete: deleteItem,
    onToggleDay: toggleDay,
    onToggleDietary: toggleDietary,
    onToggleAllergen: toggleAllergen,
    onSuggestTranslation: suggestTranslation,
    onToggleAvailable: toggleAvailable,
  };

  const desktopThead = (
    <thead>
      <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.IMAGE} className="cursor-help border-b border-dashed border-gray-400">Image</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.CODE} className="cursor-help border-b border-dashed border-gray-400">Code</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.NAME} className="cursor-help border-b border-dashed border-gray-400">Name EN / MS / ZH</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.PRICE} className="cursor-help border-b border-dashed border-gray-400">Price</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.ON} className="cursor-help border-b border-dashed border-gray-400">On</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.STAR} className="cursor-help border-b border-dashed border-gray-400">★</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.DIETARY} className="cursor-help border-b border-dashed border-gray-400">Dietary</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.ALLERGENS} className="cursor-help border-b border-dashed border-gray-400">Allergens</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.DAYS} className="cursor-help border-b border-dashed border-gray-400">Days</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.TIME} className="cursor-help border-b border-dashed border-gray-400">Time</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.DATES} className="cursor-help border-b border-dashed border-gray-400">Dates</span></th>
        <th className="px-3 py-3"><span title={COLUMN_TOOLTIPS.SORT} className="cursor-help border-b border-dashed border-gray-400">Sort</span></th>
        <th className="px-3 py-3">Actions</th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-4">
      {!photoAlertDismissed && missingPhotos.length > 0 && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">
              ⚠️ {missingPhotos.length} item{missingPhotos.length !== 1 ? "s" : ""} have no photo.
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setIsAlertExpanded((v) => !v)}
                className="rounded p-0.5 hover:bg-amber-100"
                aria-label={isAlertExpanded ? "Collapse item list" : "Expand item list"}
              >
                {isAlertExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button onClick={dismissPhotoAlert} className="rounded px-2 py-0.5 text-xs font-medium hover:bg-amber-100">
                Dismiss
              </button>
            </div>
          </div>
          {isAlertExpanded && (
            <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {missingPhotos.map((item) => (
                <button key={item.id} onClick={() => scrollToItem(item.code)} className="underline hover:text-amber-900">
                  {item.nameEn}
                </button>
              ))}
            </p>
          )}
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {restoreToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {restoreToast}
        </div>
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or code..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
      />

      {/* Quick-translate panel: when search narrows to one item, show inline MS/ZH inputs */}
      {search.trim() !== "" && searchedItems.length === 1 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 space-y-1.5">
          <p className="text-xs font-medium text-orange-700">Quick translate: {searchedItems[0].nameEn}</p>
          <div className="flex gap-2">
            <input
              placeholder="Malay (nameMs)"
              value={searchedItems[0].nameMs}
              onChange={(e) => updateItem(searchedItems[0].id, { nameMs: e.target.value })}
              className="flex-1 rounded border border-orange-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <input
              placeholder="Chinese (nameZh)"
              value={searchedItems[0].nameZh}
              onChange={(e) => updateItem(searchedItems[0].id, { nameZh: e.target.value })}
              className="flex-1 rounded border border-orange-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={activeCategory ?? ""}
          onChange={(e) => setActiveCategory(e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="">All Categories ({items.length} items)</option>
          {displayCategories.map((dc) => {
            const count = items.filter((i) => filterByDisplayCat(i, dc)).length;
            return (
              <option key={dc} value={dc}>
                {dc} ({count} item{count !== 1 ? "s" : ""})
              </option>
            );
          })}
        </select>
        <h2 className="flex-1 text-lg font-semibold text-gray-900">
          {activeCategory
            ? `${activeCategory} (${filteredItems.length} item${filteredItems.length !== 1 ? "s" : ""})`
            : `Menu Items (${items.length})`}
        </h2>
        {soldOutCount > 0 && (
          <button
            onClick={() => void handleRestoreAll()}
            disabled={restoring}
            className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${restoring ? "animate-spin" : ""}`} />
            Restore All ({soldOutCount})
          </button>
        )}
        <button
          onClick={addNewRow}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
        >
          + Add Item
        </button>
      </div>

      {filteredItems.length === 0 && search !== "" && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No items match &ldquo;{search}&rdquo;
        </p>
      )}

      {activeCategory === null ? (
        /* ——— Grouped View (All Categories) ——— */
        <>
          {/* Mobile grouped */}
          <div className="md:hidden space-y-4">
            {groupedItems.map(({ cat, label, items: groupItems }) => (
              <div key={cat} className="space-y-2">
                <div className="rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-200">
                  {label} ({groupItems.length})
                </div>
                {groupItems.length === 0 && <p className="px-2 text-xs italic text-gray-400">No items</p>}
                {groupItems.map((item) => (
                  <AdminMenuTableRow key={item.id} item={item} variant="mobile" {...rowProps} />
                ))}
              </div>
            ))}
          </div>

          {/* Desktop grouped */}
          <div className="hidden overflow-x-auto rounded-xl border bg-white md:block">
            <table className="min-w-full text-sm">
              {desktopThead}
              <tbody className="divide-y divide-gray-100">
                {groupedItems.map(({ cat, label, items: groupItems }) => (
                  <Fragment key={cat}>
                    <tr className="border-t border-b border-gray-200 bg-amber-50/60">
                      <td colSpan={13} className="px-3 py-1.5">
                        <div className="rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                          {label} ({groupItems.length})
                        </div>
                      </td>
                    </tr>
                    {groupItems.map((item) => (
                      <AdminMenuTableRow key={item.id} item={item} variant="desktop" {...rowProps} />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* ——— Filtered Flat View (Category selected) ——— */
        <>
          {/* Mobile flat */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => (
              <AdminMenuTableRow key={item.id} item={item} variant="mobile" {...rowProps} />
            ))}
          </div>

          {/* Desktop flat */}
          <div className="hidden overflow-x-auto rounded-xl border bg-white md:block">
            <table className="min-w-full text-sm">
              {desktopThead}
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => (
                  <AdminMenuTableRow key={item.id} item={item} variant="desktop" {...rowProps} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ImagePickerModal
        open={!!imagePickerCode}
        code={imagePickerCode || ""}
        onClose={() => setImagePickerCode(null)}
        onImageChanged={handleImageChange}
      />
    </div>
  );
}

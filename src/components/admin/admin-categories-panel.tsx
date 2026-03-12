"use client";

import { useState } from "react";
import type { MenuItemWithRules } from "@/types/menu";
import { SPECIAL_DISPLAY_CATEGORIES } from "@/lib/constants";

interface DisplayCategory {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
  item_count: number;
}

interface AssignedItem {
  id: string;
  name_en: string;
  code: string;
  price: number;
}

interface AdminCategoriesPanelProps {
  initialCategories?: string[];
  allItems: MenuItemWithRules[];
}

export function AdminCategoriesPanel({
  allItems,
}: AdminCategoriesPanelProps) {
  // ── Display Categories ─────────────────────────────────────────────────────
  const [displayCats, setDisplayCats] = useState<DisplayCategory[]>([]);
  const [displayLoaded, setDisplayLoaded] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [expandedDisplayId, setExpandedDisplayId] = useState<number | null>(null);
  const [assignedItems, setAssignedItems] = useState<Record<number, AssignedItem[]>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [editDisplayId, setEditDisplayId] = useState<number | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");

  // Load display categories (call eagerly when panel mounts via onClick wrapper)
  async function loadDisplayCategories() {
    if (displayLoaded) return;
    const res = await fetch("/api/admin/display-categories");
    const data = await res.json();
    setDisplayCats(data);
    setDisplayLoaded(true);
  }

  async function loadAssignedItems(catId: number) {
    if (assignedItems[catId] !== undefined) return;
    const res = await fetch(`/api/admin/display-categories/${catId}/items`);
    const data = await res.json();
    setAssignedItems((prev) => ({ ...prev, [catId]: data }));
  }

  // ── Display category CRUD ─────────────────────────────────────────────────
  async function addDisplayCategory() {
    if (!newDisplayName.trim()) return;
    setDisplayError(null);
    const res = await fetch("/api/admin/display-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDisplayName.trim(), sortOrder: displayCats.length + 1 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDisplayError(data.error || "Failed to add");
      return;
    }
    setDisplayCats((prev) => [...prev, { ...data, item_count: 0 }]);
    setNewDisplayName("");
  }

  async function saveDisplayEdit(id: number) {
    if (!editDisplayName.trim()) return;
    const res = await fetch(`/api/admin/display-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editDisplayName.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setDisplayCats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: data.name } : c))
      );
      setEditDisplayId(null);
    }
  }

  async function deleteDisplayCategory(id: number, name: string) {
    if (!confirm(`Delete display category "${name}"?`)) return;
    await fetch(`/api/admin/display-categories/${id}`, { method: "DELETE" });
    setDisplayCats((prev) => prev.filter((c) => c.id !== id));
    setAssignedItems((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (expandedDisplayId === id) setExpandedDisplayId(null);
  }

  async function toggleExpand(catId: number) {
    if (expandedDisplayId === catId) {
      setExpandedDisplayId(null);
      return;
    }
    setExpandedDisplayId(catId);
    await loadAssignedItems(catId);
    setItemSearch("");
  }

  async function assignItem(catId: number, itemId: string) {
    await fetch(`/api/admin/display-categories/${catId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    // Reload assigned items for this category
    const res = await fetch(`/api/admin/display-categories/${catId}/items`);
    const data = await res.json();
    setAssignedItems((prev) => ({ ...prev, [catId]: data }));
    setDisplayCats((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, item_count: data.length } : c))
    );
    setItemSearch("");
  }

  async function removeItem(catId: number, itemId: string) {
    await fetch(`/api/admin/display-categories/${catId}/items?itemId=${itemId}`, {
      method: "DELETE",
    });
    setAssignedItems((prev) => ({
      ...prev,
      [catId]: (prev[catId] ?? []).filter((i) => i.id !== itemId),
    }));
    setDisplayCats((prev) =>
      prev.map((c) =>
        c.id === catId ? { ...c, item_count: Math.max(0, c.item_count - 1) } : c
      )
    );
  }

  // Items not yet assigned to this display category, filtered by search
  function getUnassigned(catId: number) {
    const assigned = new Set((assignedItems[catId] ?? []).map((i) => i.id));
    const q = itemSearch.toLowerCase();
    return allItems.filter(
      (item) =>
        !assigned.has(item.id) &&
        (q === "" || item.nameEn.toLowerCase().includes(q) || item.code.toLowerCase().includes(q))
    );
  }

  return (
    <div
      className="space-y-6"
      onClick={loadDisplayCategories}
    >
      {/* ── Display Categories (website-only, not POS) ── */}
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Display Categories</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            Website only
          </span>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Curate items into website-only groups like &quot;{SPECIAL_DISPLAY_CATEGORIES.CHEFS_PICKS}&quot; or &quot;{SPECIAL_DISPLAY_CATEGORIES.VEGETARIAN}&quot; — independent of POS.
        </p>

        {displayError && (
          <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{displayError}</div>
        )}

        <div className="mb-6 flex gap-2">
          <input
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDisplayCategory()}
            placeholder="New display category (e.g. Lunch Specials)"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
          <button
            onClick={addDisplayCategory}
            className="min-h-[44px] rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            Add
          </button>
        </div>

        {!displayLoaded ? (
          <p className="text-sm text-gray-500">Click anywhere to load display categories…</p>
        ) : displayCats.length === 0 ? (
          <p className="text-sm text-gray-500">No display categories yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {displayCats.map((cat, idx) => (
              <li key={cat.id} className="py-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-xs text-gray-400">{idx + 1}</span>
                    {editDisplayId === cat.id ? (
                      <input
                        autoFocus
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveDisplayEdit(cat.id);
                          if (e.key === "Escape") setEditDisplayId(null);
                        }}
                        className="rounded border border-amber-300 px-2 py-1 text-sm outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        className="flex items-center gap-1.5 text-sm font-medium hover:text-amber-600"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id); }}
                      >
                        <span>{expandedDisplayId === cat.id ? "▾" : "▸"}</span>
                        <span>{cat.name}</span>
                      </button>
                    )}
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                      {cat.item_count} items
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {editDisplayId === cat.id ? (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); saveDisplayEdit(cat.id); }}
                          className="min-h-[44px] rounded bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100"
                        >
                          Save
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditDisplayId(null); }}
                          className="min-h-[44px] rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditDisplayId(cat.id);
                            setEditDisplayName(cat.name);
                          }}
                          className="min-h-[44px] rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
                        >
                          Rename
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteDisplayCategory(cat.id, cat.name); }}
                          className="min-h-[44px] rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded: assigned items + add items */}
                {expandedDisplayId === cat.id && (
                  <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3" onClick={(e) => e.stopPropagation()}>
                    {/* Assigned items list */}
                    {(assignedItems[cat.id] ?? []).length === 0 ? (
                      <p className="mb-3 text-xs text-gray-400">No items assigned yet.</p>
                    ) : (
                      <ul className="mb-3 space-y-1">
                        {(assignedItems[cat.id] ?? []).map((item) => (
                          <li key={item.id} className="flex items-center justify-between rounded bg-white px-2.5 py-1.5 text-sm shadow-sm">
                            <span className="truncate">{item.name_en}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-gray-400">RM{Number(item.price).toFixed(2)}</span>
                              <button
                                onClick={() => removeItem(cat.id, item.id)}
                                className="min-h-[32px] rounded px-1.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600"
                              >
                                ✕
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Add item search */}
                    <div className="space-y-1.5">
                      <input
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        placeholder="Search to add item…"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      />
                      {itemSearch.trim() && (
                        <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 bg-white shadow-sm">
                          {getUnassigned(cat.id).slice(0, 20).map((item) => (
                            <li key={item.id}>
                              <button
                                onClick={() => assignItem(cat.id, item.id)}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-amber-50"
                              >
                                <span className="truncate">{item.nameEn}</span>
                                <span className="ml-2 shrink-0 text-xs text-gray-400">
                                  RM{item.price.toFixed(2)}
                                </span>
                              </button>
                            </li>
                          ))}
                          {getUnassigned(cat.id).length === 0 && (
                            <li className="px-3 py-2 text-xs text-gray-400">No matching items</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}

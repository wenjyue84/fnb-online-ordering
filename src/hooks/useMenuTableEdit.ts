"use client";

import { useState } from "react";
import type { MenuItemWithRules } from "@/types/menu";

export type EditableItem = MenuItemWithRules & { _dirty?: boolean; _new?: boolean };

export interface UseMenuTableEditResult {
  items: EditableItem[];
  editingId: string | null;
  editForm: EditableItem | null;
  saving: string | null;
  error: string | null;
  suggesting: Record<string, boolean>;
  imgVersion: number;
  imagePickerCode: string | null;
  setImagePickerCode: (code: string | null) => void;
  handleImageChange: () => void;
  handleSave: (item: EditableItem) => Promise<void>;
  handleCancel: (item: EditableItem) => void;
  updateItem: (id: string, patch: Partial<EditableItem>) => void;
  saveItem: (item: EditableItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  addNewRow: () => void;
  toggleDay: (item: EditableItem, day: string) => void;
  toggleDietary: (item: EditableItem, d: string) => void;
  toggleCategory: (item: EditableItem, cat: string) => void;
  suggestTranslation: (item: EditableItem, lang: "ms" | "zh") => Promise<void>;
  toggleAvailable: (id: string) => Promise<void>;
  restoreAll: () => Promise<number>;
}

export function useMenuTableEdit(initialItems: MenuItemWithRules[]): UseMenuTableEditResult {
  const [items, setItems] = useState<EditableItem[]>(initialItems);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState<Record<string, boolean>>({});
  const [imgVersion, setImgVersion] = useState(0);
  const [imagePickerCode, setImagePickerCode] = useState<string | null>(null);

  function updateItem(id: string, patch: Partial<EditableItem>) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...patch, _dirty: true } : item
      )
    );
  }

  function addNewRow() {
    const tempId = `new-${Date.now()}`;
    setItems((prev) => [
      {
        id: tempId,
        code: "",
        nameEn: "",
        nameMs: "",
        nameZh: "",
        price: 0,
        description: "",
        dietary: [],
        categories: [],
        displayCategories: [],
        available: true,
        featured: false,
        photo: null,
        photos: [],
        sortOrder: 0,
        availableDays: [],
        timeFrom: "",
        timeUntil: "",
        specialDates: [],
        imagePosition: "50% 50%",
        updatedAt: new Date().toISOString(),
        isSignature: false,
        archived: false,
        _new: true,
        _dirty: true,
      },
      ...prev,
    ]);
  }

  async function saveItem(item: EditableItem) {
    setSaving(item.id);
    setError(null);
    const body = {
      code: item.code,
      nameEn: item.nameEn,
      nameMs: item.nameMs,
      nameZh: item.nameZh,
      price: item.price,
      description: item.description,
      dietary: item.dietary,
      categories: item.categories,
      available: item.available,
      featured: item.featured,
      sortOrder: item.sortOrder,
      availableDays: item.availableDays,
      timeFrom: item.timeFrom,
      timeUntil: item.timeUntil,
      specialDates: item.specialDates,
    };

    try {
      if (item._new) {
        const res = await fetch("/api/admin/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create");
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...data, photo: `/images/menu/${data.code}.jpg` } : i
          )
        );
      } else {
        const res = await fetch(`/api/admin/menu/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update");
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...data, photo: `/images/menu/${data.code}.jpg`, _dirty: false }
              : i
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(null);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this menu item?")) return;
    await fetch(`/api/admin/menu/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function toggleDay(item: EditableItem, day: string) {
    const days = item.availableDays.includes(day)
      ? item.availableDays.filter((d) => d !== day)
      : [...item.availableDays, day];
    updateItem(item.id, { availableDays: days });
  }

  function toggleDietary(item: EditableItem, d: string) {
    const dietary = item.dietary.includes(d)
      ? item.dietary.filter((x) => x !== d)
      : [...item.dietary, d];
    updateItem(item.id, { dietary });
  }

  function toggleCategory(item: EditableItem, cat: string) {
    const cats = item.categories.includes(cat)
      ? item.categories.filter((c) => c !== cat)
      : [...item.categories, cat];
    updateItem(item.id, { categories: cats });
  }

  async function suggestTranslation(item: EditableItem, lang: "ms" | "zh") {
    if (!item.nameEn) return;
    const key = `${item.id}-${lang}`;
    setSuggesting((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/admin/menu/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameEn: item.nameEn, targetLanguage: lang }),
      });
      const data = await res.json();
      if (res.ok && data.translation) {
        updateItem(item.id, lang === "ms" ? { nameMs: data.translation } : { nameZh: data.translation });
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setSuggesting((prev) => ({ ...prev, [key]: false }));
    }
  }

  /** Instant toggle: optimistically flip available, PATCH server, rollback on failure */
  async function toggleAvailable(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || item._new) return;
    const newAvailable = !item.available;
    // Optimistic update (don't set _dirty — this auto-saves)
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, available: newAvailable } : i))
    );
    try {
      const res = await fetch(`/api/admin/menu/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: newAvailable }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Rollback on failure
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, available: !newAvailable } : i))
      );
      setError("Failed to update availability");
    }
  }

  /** Restore all sold-out items to available */
  async function restoreAll(): Promise<number> {
    try {
      const res = await fetch("/api/admin/menu/restore-all", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { restored: number };
      // Update local state
      setItems((prev) => prev.map((i) => ({ ...i, available: true })));
      return data.restored;
    } catch {
      setError("Failed to restore items");
      return 0;
    }
  }

  function handleImageChange() {
    setImgVersion((v) => v + 1);
  }

  function handleCancel(item: EditableItem) {
    if (item._new) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  }

  const editForm = saving ? (items.find((i) => i.id === saving) ?? null) : null;

  return {
    items,
    editingId: saving,
    editForm,
    saving,
    error,
    suggesting,
    imgVersion,
    imagePickerCode,
    setImagePickerCode,
    handleImageChange,
    handleSave: saveItem,
    handleCancel,
    updateItem,
    saveItem,
    deleteItem,
    addNewRow,
    toggleDay,
    toggleDietary,
    toggleCategory,
    suggestTranslation,
    toggleAvailable,
    restoreAll,
  };
}

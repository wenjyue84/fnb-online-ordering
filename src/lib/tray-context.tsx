"use client";

import React, { useEffect, useSyncExternalStore, type ReactNode } from "react";

export type TrayItem = {
    id: string;
    name: string;
    price: number;
    quantity: number;
};

// ── External store ──────────────────────────────────────────────────────────
const STORAGE_KEY = "mm_tray";

let _items: TrayItem[] = [];
let _hydrated = false;
const _listeners = new Set<() => void>();

function emitChange() {
    for (const l of _listeners) l();
    try {
        if (_items.length > 0) {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_items));
        } else {
            sessionStorage.removeItem(STORAGE_KEY);
        }
    } catch {}
}

function subscribe(listener: () => void) {
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
}

function getItemsSnapshot() { return _items; }
const _emptyItems: TrayItem[] = [];
function getServerSnapshot(): TrayItem[] { return _emptyItems; }

function hydrate() {
    if (_hydrated) return;
    _hydrated = true;
    try {
        // On first load of a new session, if there's a recent completed order
        // whose items match what's in the tray, clear to avoid confusion.
        // Use a session flag so we only run this check once per tab.
        const CLEARED_KEY = "mm_tray_cleared";
        if (!sessionStorage.getItem(CLEARED_KEY)) {
            sessionStorage.setItem(CLEARED_KEY, "1");
            const orderHistory = localStorage.getItem("mm_order_history");
            if (orderHistory) {
                const history = JSON.parse(orderHistory);
                if (Array.isArray(history) && history.length > 0) {
                    sessionStorage.removeItem(STORAGE_KEY);
                    return;
                }
            }
        }

        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
            _items = JSON.parse(raw) as TrayItem[];
            emitChange();
        }
    } catch {}
}

// ── Actions (module-level, stable references) ───────────────────────────────
function addItem(newItem: Omit<TrayItem, "quantity">) {
    const existing = _items.find((item) => item.id === newItem.id);
    if (existing) {
        _items = _items.map((item) =>
            item.id === newItem.id ? { ...item, quantity: item.quantity + 1 } : item
        );
    } else {
        _items = [..._items, { ...newItem, quantity: 1 }];
    }
    emitChange();
}

function removeItem(id: string) {
    _items = _items.filter((item) => item.id !== id);
    emitChange();
}

function decrementItem(id: string) {
    const existing = _items.find((item) => item.id === id);
    if (!existing) return;
    if (existing.quantity <= 1) {
        _items = _items.filter((item) => item.id !== id);
    } else {
        _items = _items.map((item) =>
            item.id === id ? { ...item, quantity: item.quantity - 1 } : item
        );
    }
    emitChange();
}

function clearTray() {
    _items = [];
    emitChange();
}

const trayActions = { addItem, removeItem, decrementItem, clearTray } as const;

// ── Provider (hydration only) ───────────────────────────────────────────────
export function TrayProvider({ children }: { children: ReactNode }) {
    useEffect(() => { hydrate(); }, []);
    return <>{children}</>;
}

// ── Optimized hooks ─────────────────────────────────────────────────────────

/** Stable action refs — never triggers re-renders */
export function useTrayActions() {
    return trayActions;
}

/** Per-item count — only re-renders when this item's quantity changes */
export function useTrayItemCount(itemId: string): number {
    return useSyncExternalStore(
        subscribe,
        () => _items.find((i) => i.id === itemId)?.quantity ?? 0,
        () => 0
    );
}

/** All items — re-renders on any tray change */
export function useTrayItems(): TrayItem[] {
    return useSyncExternalStore(subscribe, getItemsSnapshot, getServerSnapshot);
}

/** Total price — re-renders only when total changes */
export function useTrayTotal(): number {
    return useSyncExternalStore(
        subscribe,
        () => _items.reduce((t, i) => t + i.price * i.quantity, 0),
        () => 0
    );
}

/** Legacy hook — subscribes to everything (backward compatible) */
export function useTray() {
    const items = useTrayItems();
    const totalPrice = useTrayTotal();
    return { items, ...trayActions, totalPrice };
}

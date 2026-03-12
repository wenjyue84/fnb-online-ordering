"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ShoppingCart, X, Minus, Plus, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useTray } from "@/lib/tray-context";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { OrderFormModal } from "./order-form-modal";

const ORDER_HISTORY_KEY = "mm_order_history";
const MAX_HISTORY = 5;
const POLL_INTERVAL_MS = 30_000;

interface HistoryItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderHistoryEntry {
  id: number;
  items: HistoryItem[];
  total: number;
  timestamp: string;
  status: "pending" | "approved" | "ready";
}

function loadHistory(): OrderHistoryEntry[] {
  try {
    const raw = localStorage.getItem(ORDER_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OrderHistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(history: OrderHistoryEntry[]) {
  try {
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage may be unavailable (private browsing, storage full)
  }
}

function StatusBadge({ status }: { status: OrderHistoryEntry["status"] }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 px-2 py-0.5 text-xs font-semibold">
        ✓ Ready
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2 py-0.5 text-xs font-semibold">
        👍 Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 text-xs font-semibold">
      🕓 Pending
    </span>
  );
}

export function TrayWidget() {
    const [open, setOpen] = useState(false);
    const [showOrderForm, setShowOrderForm] = useState(false);
    const [orderHistory, setOrderHistory] = useState<OrderHistoryEntry[]>([]);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [badgeBounce, setBadgeBounce] = useState(false);
    const { items, addItem, removeItem, clearTray, totalPrice } = useTray();
    const t = useTranslations("tray");

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const prevTotalRef = useRef(totalItems);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Bounce badge + animate button when item count increases
    useEffect(() => {
        if (totalItems > prevTotalRef.current) {
            setBadgeBounce(true);
            const badgeTimer = setTimeout(() => setBadgeBounce(false), 300);
            // Re-trigger animation even if already playing (reflow trick)
            if (buttonRef.current) {
                buttonRef.current.classList.remove("animate-tray-pop");
                void buttonRef.current.offsetWidth; // force reflow
                buttonRef.current.classList.add("animate-tray-pop");
            }
            const btnTimer = setTimeout(() => {
                buttonRef.current?.classList.remove("animate-tray-pop");
            }, 500);
            prevTotalRef.current = totalItems;
            return () => {
                clearTimeout(badgeTimer);
                clearTimeout(btnTimer);
            };
        }
        prevTotalRef.current = totalItems;
    }, [totalItems]);

    // Close tray side panel on Escape key
    useEffect(() => {
        if (!open) return;
        function handleEsc(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setOpen(false);
                buttonRef.current?.focus();
            }
        }
        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc);
    }, [open]);

    const hasTomYum = items.some(i => i.name.toLowerCase().includes('tom yum'));
    const hasOmelette = items.some(i => i.name.toLowerCase().includes('omelette'));
    const showPairingBanner = hasTomYum && !hasOmelette;

    // Load history from localStorage on mount
    useEffect(() => {
        setOrderHistory(loadHistory());
    }, []);

    // Poll for status updates on non-final orders
    const pollStatuses = useCallback(async (history: OrderHistoryEntry[]) => {
        const nonFinal = history.filter(o => o.status !== "ready");
        if (nonFinal.length === 0) return;

        const updates = await Promise.allSettled(
            nonFinal.map(async (order) => {
                const res = await fetch(`/api/orders/${order.id}`);
                if (!res.ok) return null;
                const data = await res.json() as { id: number; status: string };
                return { id: data.id, status: data.status as OrderHistoryEntry["status"] };
            })
        );

        setOrderHistory(prev => {
            const updated = prev.map(order => {
                const match = updates.find(
                    r => r.status === "fulfilled" && r.value && r.value.id === order.id
                );
                if (match && match.status === "fulfilled" && match.value) {
                    return { ...order, status: match.value.status };
                }
                return order;
            });
            saveHistory(updated);
            return updated;
        });
    }, []);

    useEffect(() => {
        if (orderHistory.length === 0) return;
        const interval = setInterval(() => pollStatuses(orderHistory), POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [orderHistory, pollStatuses]);

    if (totalItems === 0 && !open && orderHistory.length === 0) return null;

    // Show floating button only when tray has items (US-148)
    const showFloatingButton = totalItems > 0;

    return (
        <>
            {/* Tray Background Overlay */}
            {open && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Tray Side Panel */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={t("title")}
                className={cn(
                    "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300 ease-in-out sm:rounded-l-2xl",
                    open ? "translate-x-0" : "translate-x-full"
                )}
            >
                <div className="flex items-center justify-between border-b p-4">
                    <h2 className="text-xl font-bold">{t("title")}</h2>
                    <button
                        onClick={() => setOpen(false)}
                        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted transition-colors"
                        aria-label={t("close") ?? "Close cart"}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
                    {/* AI Pairing Banner */}
                    <div
                        className={cn(
                            "overflow-hidden transition-all duration-500 ease-in-out",
                            showPairingBanner ? "max-h-32 opacity-100 mb-4" : "max-h-0 opacity-0 mb-0 pointer-events-none"
                        )}
                    >
                        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 shadow-sm transform transition-transform duration-500 hover:scale-[1.02]">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">👨‍🍳</span>
                                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100 leading-snug">
                                        <b className="font-bold">AI Chef recommends:</b><br />Pair this with crispy Omelette!
                                    </p>
                                </div>
                                <button
                                    onClick={() => addItem({ id: "SF02", name: "Crispy Omelette", price: 12.90 })}
                                    className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-sm"
                                >
                                    + Add
                                </button>
                            </div>
                        </div>
                    </div>

                    {items.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center text-muted-foreground opacity-60">
                            <ShoppingCart className="h-16 w-16 mb-4" />
                            <p className="text-lg">{t("empty")}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors"
                                >
                                    <div>
                                        <p className="font-semibold text-lg">
                                            {item.id} {item.name}
                                        </p>
                                        <p className="text-muted-foreground font-medium">
                                            RM {(item.price * item.quantity).toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 bg-background border shadow-sm rounded-full p-1">
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="rounded-full h-11 w-11 flex items-center justify-center hover:bg-muted transition-colors"
                                            aria-label={`Decrease quantity of ${item.name}`}
                                        >
                                            <Minus className="h-4 w-4" />
                                        </button>
                                        <span className="w-6 text-center font-semibold" aria-live="polite" aria-atomic="true">{item.quantity}</span>
                                        <button
                                            onClick={() => addItem(item)}
                                            className="rounded-full h-11 w-11 flex items-center justify-center hover:bg-muted transition-colors"
                                            aria-label={`Increase quantity of ${item.name}`}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Order History Section */}
                    {orderHistory.length > 0 && (
                        <div className="mt-6 border-t pt-4">
                            <button
                                onClick={() => setHistoryOpen(h => !h)}
                                className="w-full flex items-center justify-between text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
                            >
                                <span className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    {t("orderHistory")} ({orderHistory.length})
                                </span>
                                {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            {historyOpen && (
                                <div className="mt-3 space-y-4">
                                    {orderHistory.map((order) => (
                                        <div
                                            key={order.id}
                                            className="rounded-xl border bg-muted/30 p-3 space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                                <StatusBadge status={order.status} />
                                            </div>
                                            <div className="space-y-1">
                                                {order.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm">
                                                        <span>{item.quantity}× {item.name}</span>
                                                        <span className="text-muted-foreground">RM {(item.price * item.quantity).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between text-sm font-bold pt-1 border-t border-border/40">
                                                <span>Total</span>
                                                <span>RM {order.total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {items.length > 0 && (
                    <div className="border-t p-5 space-y-4 bg-background z-10">
                        <div className="flex justify-between items-center text-xl font-bold">
                            <span>{t("total")}</span>
                            <span className="text-primary">RM {totalPrice.toFixed(2)}</span>
                        </div>
                        <button
                            onClick={() => setShowOrderForm(true)}
                            className="w-full rounded-full bg-primary py-4 text-primary-foreground font-bold text-lg hover:bg-primary/90 flex justify-center items-center gap-2 shadow-lg transition-transform active:scale-[0.98]"
                        >
                            <ShoppingCart className="h-6 w-6" />
                            <span className="hidden md:inline">{t("sendOrderToWaiter")}</span>
                            <span className="md:hidden">{t("sendOrder")}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Sticky bottom cart bar — mobile only */}
            {showFloatingButton && !open && (
                <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden animate-in slide-in-from-bottom-4 duration-300">
                    <button
                        onClick={() => setOpen(true)}
                        className="w-full flex items-center gap-3 bg-orange-500 text-white px-5 min-h-[56px] active:bg-orange-600 transition-colors shadow-[0_-2px_10px_rgba(0,0,0,0.15)]"
                        style={{ paddingTop: "0.875rem", paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
                        aria-label="View cart"
                        aria-expanded={open}
                    >
                        <ShoppingCart className="h-5 w-5 shrink-0" />
                        <span className={cn("flex-1 text-left text-sm font-semibold", badgeBounce && "badge-bounce")}>
                            {totalItems} {totalItems === 1 ? "item" : "items"}
                        </span>
                        <span className="text-sm font-bold">RM {totalPrice.toFixed(2)}</span>
                        <span className="ml-1 text-sm font-semibold opacity-90">View →</span>
                    </button>
                </div>
            )}

            {/* Floating button — hidden on mobile when sticky bar is shown */}
            {showFloatingButton && (
                <button
                    ref={buttonRef}
                    onClick={() => setOpen(true)}
                    className={cn(
                        "hidden sm:flex fixed bottom-4 right-20 z-40 h-14 items-center justify-center rounded-full bg-orange-500 px-4 text-white shadow-lg transition-transform hover:scale-105 gap-2",
                        open && "!hidden",
                    )}
                    aria-label="View cart"
                    aria-expanded={open}
                >
                    <ShoppingCart className="h-6 w-6" />
                    {totalItems > 0 && (
                        <span className={cn("font-bold text-lg inline-block", badgeBounce && "badge-bounce")}>
                            {totalItems}
                        </span>
                    )}
                </button>
            )}

            {/* Pre-order form modal */}
            {showOrderForm && (
                <OrderFormModal
                    items={items}
                    total={totalPrice}
                    onSuccess={(orderId) => {
                        const entry: OrderHistoryEntry = {
                            id: orderId,
                            items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
                            total: totalPrice,
                            timestamp: new Date().toISOString(),
                            status: "pending",
                        };
                        setOrderHistory(prev => {
                            const updated = [entry, ...prev].slice(0, MAX_HISTORY);
                            saveHistory(updated);
                            return updated;
                        });
                        clearTray();
                        setOpen(false);
                    }}
                    onClose={() => setShowOrderForm(false)}
                />
            )}
        </>
    );
}

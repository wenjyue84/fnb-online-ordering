"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface KdsOrder {
  id: number;
  items: OrderItem[];
  total: string;
  status: string;
  contact_number: string | null;
  estimated_arrival: string | null;
  estimated_ready: string | null;
  payment_screenshot_url: string | null;
  feedme_entered: boolean | null;
  created_at: string;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function elapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function etaRemainingMinutes(estimatedArrival: string | null): number | null {
  if (!estimatedArrival) return null;
  return Math.floor((new Date(estimatedArrival).getTime() - Date.now()) / 60000);
}

function getEtaClasses(estimatedArrival: string | null): { border: string; bg: string } {
  const mins = etaRemainingMinutes(estimatedArrival);
  if (mins === null) return { border: "border-gray-600", bg: "bg-gray-800" };
  if (mins <= 5) return { border: "border-red-500", bg: "bg-red-950" };
  if (mins <= 10) return { border: "border-yellow-500", bg: "bg-yellow-950/40" };
  return { border: "border-green-600", bg: "bg-gray-800" };
}

function DepositBadge({ order }: { order: KdsOrder }) {
  if (order.status === "approved") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-900/50 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
        Deposit Pending
      </span>
    );
  }
  if (order.payment_screenshot_url) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-900/50 px-2.5 py-0.5 text-xs font-semibold text-green-300">
        Paid ✓
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-semibold text-gray-400">
      No Deposit
    </span>
  );
}

function playNewOrderChime() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const freqs = [880, 1100, 1320];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + i * 0.15);
      gain.gain.setValueAtTime(0.4, t + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.4);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 0.4);
    });
  } catch {
    // Audio not available in this context
  }
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className ?? "h-6 w-6"}
    >
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className ?? "h-6 w-6"}
    >
      <circle cx="12" cy="12" r="9.75" />
    </svg>
  );
}

interface OrderCardProps {
  order: KdsOrder;
  completedItems: Set<number>;
  onToggleItem: (itemIdx: number) => void;
  onAction: (action: "start" | "ready") => void;
  isActing: boolean;
  isNew: boolean;
  onAcknowledge: () => void;
  posMode: "builtin" | "feedme_manual";
}

function OrderCard({
  order,
  completedItems,
  onToggleItem,
  onAction,
  isActing,
  isNew,
  onAcknowledge,
  posMode,
}: OrderCardProps) {
  const [elapsed, setElapsed] = useState(elapsedMinutes(order.created_at));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(elapsedMinutes(order.created_at));
    }, 60000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  const [feedmeEntered, setFeedmeEntered] = useState<boolean>(order.feedme_entered ?? false);
  const [feedmeLoading, setFeedmeLoading] = useState(false);

  const isPreparing = order.status === "preparing";
  const isApproved = order.status === "approved";
  const allItemsDone =
    isPreparing &&
    order.items.length > 0 &&
    order.items.every((_, i) => completedItems.has(i));
  const needsFeedmeCheck = posMode === "feedme_manual" && isPreparing && !feedmeEntered;

  async function handleFeedmeEntered(checked: boolean) {
    if (!checked) return;
    setFeedmeLoading(true);
    try {
      await fetch(`/api/kds/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "feedme_entered" }),
      });
      setFeedmeEntered(true);
    } catch {
      // best-effort
    } finally {
      setFeedmeLoading(false);
    }
  }

  const { border, bg } = isNew
    ? { border: "border-yellow-400 animate-pulse", bg: "bg-yellow-950/40" }
    : getEtaClasses(order.estimated_arrival);

  const etaMins = etaRemainingMinutes(order.estimated_arrival);

  return (
    <div
      className={`rounded-2xl border-2 p-6 shadow-lg ${border} ${bg}`}
      onClick={isNew ? onAcknowledge : undefined}
    >
      {/* NEW badge */}
      {isNew && (
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400 px-3 py-1 text-xs font-black uppercase tracking-widest text-gray-900">
            🔔 NEW ORDER
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAcknowledge();
            }}
            className="text-xs text-yellow-400 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status + Deposit badges */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
            isApproved
              ? "bg-blue-900/50 text-blue-300"
              : "bg-orange-900/50 text-orange-300"
          }`}
        >
          {isApproved ? "Approved" : "Preparing"}
        </span>
        <DepositBadge order={order} />
      </div>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Order</p>
          <p className="text-4xl font-black text-white">#{order.id}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-orange-400">{elapsed}m</p>
          <p className="text-xs text-gray-400">elapsed</p>
        </div>
      </div>

      {/* ETA */}
      <div className="mb-5 rounded-xl bg-gray-900/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Customer ETA</p>
        <p className="mt-0.5 text-xl font-bold text-white">
          {formatTime(order.estimated_arrival)}
          <span className="ml-2 text-base font-normal text-gray-400">
            {formatDate(order.estimated_arrival)}
          </span>
        </p>
        {etaMins !== null && (
          <p
            className={`mt-0.5 text-sm font-semibold ${
              etaMins <= 5
                ? "text-red-400"
                : etaMins <= 10
                  ? "text-yellow-400"
                  : "text-green-400"
            }`}
          >
            {etaMins > 0 ? `${etaMins}m remaining` : "Customer arriving now"}
          </p>
        )}
      </div>

      {/* Items — tap to complete (only for preparing orders) */}
      {isPreparing ? (
        <ul className="space-y-1">
          {order.items.map((item, i) => {
            const done = completedItems.has(i);
            return (
              <li key={i}>
                <button
                  onClick={() => onToggleItem(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                    done
                      ? "text-gray-400 hover:bg-gray-700/40"
                      : "text-white hover:bg-gray-700/60"
                  }`}
                >
                  {done ? (
                    <CheckCircleIcon className="h-6 w-6 shrink-0 text-green-400" />
                  ) : (
                    <CircleIcon className="h-6 w-6 shrink-0 text-gray-500" />
                  )}
                  <span className={`flex-1 text-lg font-semibold ${done ? "line-through" : ""}`}>
                    {item.name}
                  </span>
                  <span
                    className={`shrink-0 rounded-lg px-3 py-1 text-lg font-black ${
                      done ? "bg-gray-600 text-gray-400" : "bg-orange-500 text-white"
                    }`}
                  >
                    ×{item.quantity}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-1">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl px-3 py-2">
              <span className="flex-1 text-lg font-semibold text-white">{item.name}</span>
              <span className="shrink-0 rounded-lg bg-blue-600 px-3 py-1 text-lg font-black text-white">
                ×{item.quantity}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-gray-700 pt-4">
        <p className="text-sm text-gray-400">{order.contact_number ?? "No contact"}</p>
        <p className="text-xl font-bold text-white">RM {parseFloat(order.total).toFixed(2)}</p>
      </div>

      {/* Action buttons */}
      {isApproved && (
        <button
          onClick={() => onAction("start")}
          disabled={isActing}
          className="mt-4 w-full min-h-[56px] rounded-xl bg-blue-600 py-3 text-lg font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
        >
          {isActing ? "Starting…" : "▶ Start Preparing"}
        </button>
      )}

      {isPreparing && posMode === "feedme_manual" && (
        <div className="mt-4 rounded-xl bg-yellow-900/40 border border-yellow-600 px-4 py-3">
          <p className="text-xs font-semibold text-yellow-300 mb-2">Enter this order into FeedMe POS</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={feedmeEntered}
              onChange={(e) => void handleFeedmeEntered(e.target.checked)}
              disabled={feedmeLoading || feedmeEntered}
              className="h-5 w-5 rounded border-gray-500 text-orange-500 focus:ring-orange-400"
            />
            <span className="text-sm text-yellow-200">
              {feedmeEntered ? "✓ Entered into FeedMe" : feedmeLoading ? "Saving…" : "Entered into FeedMe POS"}
            </span>
          </label>
        </div>
      )}

      {isPreparing && allItemsDone && (
        <button
          onClick={() => onAction("ready")}
          disabled={isActing || needsFeedmeCheck}
          title={needsFeedmeCheck ? "Please enter into FeedMe POS first" : undefined}
          className="mt-4 w-full min-h-[56px] rounded-xl bg-green-500 py-3 text-lg font-bold text-white transition-colors hover:bg-green-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isActing ? "Marking Ready…" : "✅ Mark as Ready"}
        </button>
      )}
    </div>
  );
}

export default function KdsPage() {
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [completedItems, setCompletedItems] = useState<Map<number, Set<number>>>(new Map());
  const [actingOn, setActingOn] = useState<Set<number>>(new Set());
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());
  const [muted, setMuted] = useState(false);
  const [posMode, setPosMode] = useState<"builtin" | "feedme_manual">("feedme_manual");

  const prevOrderIdsRef = useRef<Set<number> | null>(null);
  const dismissTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const acknowledgeOrder = useCallback((orderId: number) => {
    setNewOrderIds((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
    const timer = dismissTimersRef.current.get(orderId);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(orderId);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/kds/orders");
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/kds/login";
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { orders: KdsOrder[] };
      const incoming = data.orders;

      // Detect new orders
      if (prevOrderIdsRef.current !== null) {
        const arrivedIds = incoming
          .map((o) => o.id)
          .filter((id) => !prevOrderIdsRef.current!.has(id));

        if (arrivedIds.length > 0) {
          if (!muted) playNewOrderChime();
          setNewOrderIds((prev) => {
            const next = new Set(prev);
            arrivedIds.forEach((id) => next.add(id));
            return next;
          });
          arrivedIds.forEach((id) => {
            const existing = dismissTimersRef.current.get(id);
            if (existing) clearTimeout(existing);
            const timer = setTimeout(() => {
              setNewOrderIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              dismissTimersRef.current.delete(id);
            }, 60000);
            dismissTimersRef.current.set(id, timer);
          });
        }
      }

      prevOrderIdsRef.current = new Set(incoming.map((o) => o.id));
      setOrders(incoming);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, [muted]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { posMode?: "builtin" | "feedme_manual" } | null) => {
        if (d?.posMode) setPosMode(d.posMode);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void fetchOrders();
    const interval = setInterval(() => void fetchOrders(), 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    const timers = dismissTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const toggleItem = useCallback((orderId: number, itemIdx: number) => {
    setCompletedItems((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(orderId) ?? []);
      if (set.has(itemIdx)) {
        set.delete(itemIdx);
      } else {
        set.add(itemIdx);
      }
      next.set(orderId, set);
      return next;
    });
  }, []);

  const handleAction = useCallback(
    async (orderId: number, action: "start" | "ready") => {
      setActingOn((prev) => new Set(prev).add(orderId));
      try {
        const res = await fetch(`/api/kds/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        // Remove from list optimistically
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setCompletedItems((prev) => {
          const next = new Map(prev);
          next.delete(orderId);
          return next;
        });
        setNewOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
        // Refresh to pick up updated status
        void fetchOrders();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to update order");
      } finally {
        setActingOn((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }
    },
    [fetchOrders]
  );

  const approvedCount = orders.filter((o) => o.status === "approved").length;
  const preparingCount = orders.filter((o) => o.status === "preparing").length;

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Kitchen Display</h1>
          <p className="text-sm text-gray-400">
            ↻ Auto-refresh every 15s
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMuted((m) => !m)}
            title={muted ? "Unmute alerts" : "Mute alerts"}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              muted
                ? "bg-gray-700 text-gray-400 hover:bg-gray-600"
                : "bg-orange-600 text-white hover:bg-orange-500"
            }`}
          >
            {muted ? "🔇 Muted" : "🔔 Sound On"}
          </button>
          <div className="text-right">
            <p className="text-xs text-gray-500">
              Updated{" "}
              {lastRefresh.toLocaleTimeString("en-MY", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {approvedCount > 0 && (
                <span className="mr-2 text-blue-400">{approvedCount} approved</span>
              )}
              {preparingCount > 0 && (
                <span className="text-orange-400">{preparingCount} preparing</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <p className="text-2xl text-gray-400">Loading orders…</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-700 bg-red-950 p-6 text-center">
          <p className="text-xl text-red-300">{error}</p>
          <button
            onClick={() => void fetchOrders()}
            className="mt-4 rounded-lg bg-red-700 px-6 py-3 text-white hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
          <p className="text-6xl">🎉</p>
          <p className="text-2xl font-bold text-gray-300">No active orders — kitchen is clear</p>
          <p className="text-gray-500">All orders have been handled.</p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              completedItems={completedItems.get(order.id) ?? new Set()}
              onToggleItem={(idx) => toggleItem(order.id, idx)}
              onAction={(action) => void handleAction(order.id, action)}
              isActing={actingOn.has(order.id)}
              isNew={newOrderIds.has(order.id)}
              onAcknowledge={() => acknowledgeOrder(order.id)}
              posMode={posMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

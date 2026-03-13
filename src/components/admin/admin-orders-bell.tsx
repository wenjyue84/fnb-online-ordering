"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { getAlarmManager } from "@/lib/alarm-manager";
import { AlarmControls } from "@/components/shared/alarm-controls";

interface TrayOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface TrayOrder {
  id: number;
  items: TrayOrderItem[];
  total: string;
  status: string;
  created_at: string;
}

type ConnectionStatus = "live" | "polling" | "connecting";

export function AdminOrdersBell() {
  const [orders, setOrders] = useState<TrayOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("connecting");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Escalation minutes — fetched from settings, passed to SSE stream
  const escalationMinutesRef = useRef(10);

  // SSE refs
  const esRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_RECONNECT = 3;

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) return;
      const data: TrayOrder[] = await res.json();
      setOrders(data);
    } catch {
      // Silently fail — bell is non-critical UI
    }
  }, []);

  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) return; // already polling
    setConnStatus("polling");
    void fetchOrders();
    pollingIntervalRef.current = setInterval(() => void fetchOrders(), 30_000);
  }, [fetchOrders]);

  const stopPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const connectSSE = useCallback(() => {
    // Close any existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setConnStatus("connecting");

    const es = new EventSource(`/api/admin/orders/stream?em=${escalationMinutesRef.current}`);
    esRef.current = es;

    es.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnStatus("live");
      stopPollingFallback();
    };

    es.addEventListener("new_order", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data as string) as {
          id: number;
          total: string;
          itemCount: number;
          createdAt: string;
        };
        // Play chime for new order
        getAlarmManager().play("chime");
        // Add synthetic order to state for bell badge
        setOrders((prev) => {
          if (prev.some((o) => o.id === data.id)) return prev;
          return [
            {
              id: data.id,
              items: [],
              total: data.total,
              status: "pending_approval",
              created_at: data.createdAt,
            },
            ...prev,
          ];
        });
        // Refresh full order list to get item details
        void fetchOrders();
      } catch {
        // parse error — ignore
      }
    });

    // Escalation event (US-604) — play urgent alarm + trigger push notification
    es.addEventListener("escalation", (ev: MessageEvent) => {
      getAlarmManager().play("urgent");
      // Fire-and-forget: send push notification to admin devices
      try {
        const data = JSON.parse(ev.data as string) as { id: string | number };
        void fetch("/api/admin/escalation-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.id }),
        });
      } catch {
        // parse error — alarm still plays
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setConnStatus("connecting");

      reconnectAttemptsRef.current += 1;
      if (reconnectAttemptsRef.current >= MAX_RECONNECT) {
        // Fall back to polling
        startPollingFallback();
        return;
      }
      // Schedule reconnect
      reconnectTimerRef.current = setTimeout(() => {
        connectSSE();
      }, 5_000);
    };
  }, [fetchOrders, startPollingFallback, stopPollingFallback]);

  // Fetch escalation minutes on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { escalationMinutes?: number } | null) => {
        if (typeof d?.escalationMinutes === "number") {
          escalationMinutesRef.current = d.escalationMinutes;
        }
      })
      .catch(() => {});
  }, []);

  // Mount: initial order fetch + start SSE
  useEffect(() => {
    void fetchOrders();
    if (typeof EventSource !== "undefined") {
      connectSSE();
    } else {
      startPollingFallback();
    }
    return () => {
      esRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [connectSSE, fetchOrders, startPollingFallback]);

  // Listen for admin:orders-viewed event — mute badge while Orders tab is active
  useEffect(() => {
    function handleOrdersViewed() { setMuted(true); }
    window.addEventListener("admin:orders-viewed", handleOrdersViewed);
    return () => window.removeEventListener("admin:orders-viewed", handleOrdersViewed);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const pendingOrders = orders.filter(
    (o) => o.status === "pending" || o.status === "pending_approval"
  );
  const pendingCount = muted ? 0 : pendingOrders.length;

  async function markSeen(id: number) {
    setMarking(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "seen" }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, status: "seen" } : o))
        );
      }
    } catch {
      // Silently fail
    } finally {
      setMarking(null);
    }
  }

  function formatTime(isoString: string) {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        aria-label="Order notifications"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
        {/* Connection status dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${
            connStatus === "live"
              ? "bg-green-500"
              : connStatus === "polling"
                ? "bg-gray-400"
                : "bg-yellow-400"
          }`}
          title={connStatus === "live" ? "Live" : connStatus === "polling" ? "Polling" : "Connecting…"}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-white shadow-xl z-50 overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Customer Orders{" "}
                  {pendingCount > 0 && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                      {pendingCount} pending
                    </span>
                  )}
                </h3>
                {/* Live/Polling label */}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    connStatus === "live"
                      ? "bg-green-100 text-green-700"
                      : connStatus === "polling"
                        ? "bg-gray-100 text-gray-500"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      connStatus === "live"
                        ? "bg-green-500"
                        : connStatus === "polling"
                          ? "bg-gray-400"
                          : "bg-yellow-400"
                    }`}
                  />
                  {connStatus === "live" ? "Live" : connStatus === "polling" ? "Polling" : "…"}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 hover:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            {/* Alarm controls */}
            <AlarmControls theme="light" className="mt-2" />
          </div>

          <div className="max-h-96 overflow-y-auto">
            {orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No orders yet</p>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className={`border-b px-4 py-3 last:border-0 transition-colors ${
                    order.status === "pending" || order.status === "pending_approval"
                      ? "bg-orange-50"
                      : "bg-white opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">{formatTime(order.created_at)}</span>
                        {(order.status === "pending" || order.status === "pending_approval") && (
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 uppercase tracking-wide">
                            New
                          </span>
                        )}
                      </div>
                      {order.items.length > 0 && (
                        <ul className="text-sm text-gray-700 space-y-0.5">
                          {order.items.map((item, i) => (
                            <li key={i}>
                              {item.quantity}x {item.name}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-1 font-semibold text-sm text-gray-900">
                        Total: RM {Number(order.total).toFixed(2)}
                      </p>
                    </div>
                    {(order.status === "pending" || order.status === "pending_approval") && (
                      <button
                        onClick={() => void markSeen(order.id)}
                        disabled={marking === order.id}
                        className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        {marking === order.id ? "..." : "Mark Seen"}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

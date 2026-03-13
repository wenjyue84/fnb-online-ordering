"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout } from "@/lib/utils";

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface AdminOrder {
  id: number;
  items: OrderItem[];
  total: string;
  status: string;
  contact_number: string | null;
  estimated_arrival: string | null;
  estimated_ready: string | null;
  rejection_reason: string | null;
  payment_screenshot_url: string | null;
  notification_status: string | null;
  feedme_entered: boolean | null;
  created_at: string;
}

export type FilterTab = "All" | "Pending" | "Active" | "Done" | "Expired";

export function filterOrders(orders: AdminOrder[], tab: FilterTab) {
  if (tab === "Pending") return orders.filter((o) => o.status === "pending_approval" || o.status === "pending");
  if (tab === "Active") return orders.filter((o) => ["approved", "payment_pending", "payment_uploaded", "preparing"].includes(o.status));
  if (tab === "Done") return orders.filter((o) => o.status === "ready" || o.status === "rejected" || o.status === "seen");
  if (tab === "Expired") return orders.filter((o) => o.status === "expired");
  return orders;
}

export type ActionResult = { ok: boolean; error?: string };

export function useAdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("Pending");

  const updateOrder = useCallback((id: number, changes: Partial<AdminOrder>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...changes } : o)));
  }, []);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/admin/orders");
      if (!res.ok) { setError("Failed to load orders"); return; }
      const data: AdminOrder[] = await res.json();
      setOrders(data);
    } catch {
      if (!silent) setError("Network error loading orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const approveOrder = useCallback(async (id: number, estimatedReady: string): Promise<ActionResult> => {
    try {
      const res = await fetchWithTimeout(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", estimatedReady }),
      });
      if (!res.ok) {
        const d = await res.json();
        return { ok: false, error: d.error ?? "Failed to approve" };
      }
      const data = await res.json() as { status: string; estimated_ready: string };
      // Use the status returned by the server (respects depositRequired setting)
      updateOrder(id, { status: data.status, estimated_ready: data.estimated_ready });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error && err.name === "AbortError" ? "Request timed out" : "Network error" };
    }
  }, [updateOrder]);

  const bulkApprove = useCallback(async (): Promise<{ approved: number; failed: number } | null> => {
    try {
      const res = await fetchWithTimeout("/api/admin/orders/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json() as { approved: number; failed: number };
      // Refresh orders list after bulk approve
      await fetchOrders(true);
      return data;
    } catch {
      return null;
    }
  }, [fetchOrders]);

  const rejectOrder = useCallback(async (id: number, reason: string): Promise<ActionResult> => {
    try {
      const res = await fetchWithTimeout(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectionReason: reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        return { ok: false, error: d.error ?? "Failed to reject" };
      }
      updateOrder(id, { status: "rejected", rejection_reason: reason });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error && err.name === "AbortError" ? "Request timed out" : "Network error" };
    }
  }, [updateOrder]);

  const updateStatus = useCallback(async (
    id: number,
    action: "confirm_payment" | "mark_ready" | "reject_payment",
    extra?: { reason?: string }
  ): Promise<ActionResult> => {
    const body: Record<string, string> = { action };
    if (extra?.reason) body.rejectionReason = extra.reason;
    try {
      const res = await fetchWithTimeout(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        return { ok: false, error: d.error ?? "Failed to update status" };
      }
      if (action === "confirm_payment") updateOrder(id, { status: "preparing" });
      else if (action === "mark_ready") updateOrder(id, { status: "ready" });
      else if (action === "reject_payment") updateOrder(id, { status: "payment_pending", rejection_reason: extra?.reason });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error && err.name === "AbortError" ? "Request timed out" : "Network error" };
    }
  }, [updateOrder]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("admin:orders-viewed"));
  }, []);

  const pendingCount = orders.filter(
    (o) => o.status === "pending_approval" || o.status === "pending"
  ).length;

  const filtered = filterOrders(orders, filterTab);

  return {
    orders,
    loading,
    error,
    refreshing,
    filterTab,
    setFilterTab,
    pendingCount,
    filtered,
    fetchOrders,
    approveOrder,
    bulkApprove,
    rejectOrder,
    updateStatus,
  };
}

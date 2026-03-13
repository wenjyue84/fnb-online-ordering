"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminOrders, type FilterTab } from "@/hooks/useAdminOrders";
import { AdminOrderCard } from "./admin-order-card";

const FILTER_TABS: FilterTab[] = ["All", "Pending", "Active", "Done", "Expired"];

export function AdminOrdersPanel() {
  const {
    orders,
    loading,
    refreshing,
    filterTab,
    setFilterTab,
    pendingCount,
    filtered,
    fetchOrders,
    approveOrder,
    rejectOrder,
    updateStatus,
  } = useAdminOrders();

  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkToast, setBulkToast] = useState<string | null>(null);
  const [posMode, setPosMode] = useState<"builtin" | "feedme_manual">("feedme_manual");
  const [escalationMinutes, setEscalationMinutes] = useState(10);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { posMode?: "builtin" | "feedme_manual"; escalationMinutes?: number } | null) => {
        if (d?.posMode) setPosMode(d.posMode);
        if (typeof d?.escalationMinutes === "number") setEscalationMinutes(d.escalationMinutes);
      })
      .catch(() => {});
  }, []);

  const expiredCount = orders.filter((o) => o.status === "expired").length;

  async function handleBulkApprove() {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/orders/bulk-approve", { method: "POST" });
      const data = await res.json() as { approved: number; failed: number };
      if (data.failed > 0) {
        setBulkToast(`${data.approved} approved, ${data.failed} failed`);
      } else {
        setBulkToast(`${data.approved} order${data.approved !== 1 ? "s" : ""} approved`);
      }
      setTimeout(() => setBulkToast(null), 4000);
      await fetchOrders(true);
    } catch {
      setBulkToast("Bulk approve failed");
      setTimeout(() => setBulkToast(null), 4000);
    } finally {
      setBulkLoading(false);
      setBulkConfirm(false);
    }
  }

  return (
    <div>
      {/* Bulk approve confirmation modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Approve All Pending ({pendingCount})?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Approve all {pendingCount} pending orders? Ready times will be auto-calculated.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void handleBulkApprove()}
                disabled={bulkLoading}
                className="flex-1 min-h-[40px] rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCheck className="h-4 w-4" />
                {bulkLoading ? "Approving…" : "Confirm"}
              </button>
              <button
                onClick={() => setBulkConfirm(false)}
                disabled={bulkLoading}
                className="min-h-[40px] rounded-lg border border-gray-300 px-4 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {bulkToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {bulkToast}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Pre-Orders</h2>
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filterTab === "Pending" && pendingCount > 0 && (
            <button
              onClick={() => setBulkConfirm(true)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Approve All Pending ({pendingCount})
            </button>
          )}
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={cn(
              "min-h-[40px] px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              filterTab === tab
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {tab}
            {tab === "Pending" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
            {tab === "Expired" && expiredCount > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-400 text-white text-[10px] font-bold px-1.5 py-0.5">
                {expiredCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Order list */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading orders…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">No orders in this category.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((order) => (
            <AdminOrderCard
              key={order.id}
              order={order}
              posMode={posMode}
              escalationMinutes={escalationMinutes}
              onApprove={approveOrder}
              onReject={rejectOrder}
              onStatusUpdate={updateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

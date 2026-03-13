"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Check,
  X,
  Clock,
  Printer,
  Eye,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTimeCompact, formatTime } from "@/lib/date-utils";
import { calculateSmartReadyTime, toDatetimeLocal } from "@/lib/orders";
import type { AdminOrder, ActionResult } from "@/hooks/useAdminOrders";
import { STATUS_LABELS, STATUS_COLORS } from "@/components/admin/admin-order-card";

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS = ["Pending", "Preparing", "Ready"] as const;
type Column = (typeof COLUMNS)[number];

function getColumn(order: AdminOrder): Column {
  if (order.status === "pending_approval" || order.status === "pending") return "Pending";
  if (order.status === "ready") return "Ready";
  return "Preparing"; // approved, payment_uploaded, preparing
}

// ─── Daily summary ────────────────────────────────────────────────────────────

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function elapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
}

// ─── Approve Modal ────────────────────────────────────────────────────────────

interface ApproveModalProps {
  orderId: number;
  items: { quantity: number }[];
  onClose: () => void;
  onApprove: (id: number, estimatedReady: string) => Promise<ActionResult>;
}

function ApproveModal({ orderId, items, onClose, onApprove }: ApproveModalProps) {
  const [readyTime, setReadyTime] = useState(() => toDatetimeLocal(calculateSmartReadyTime(items)));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!readyTime) { setErr("Please select an estimated ready time."); return; }
    setSaving(true);
    setErr("");
    const result = await onApprove(orderId, new Date(readyTime).toISOString());
    if (!result.ok) { setErr(result.error ?? "Failed to approve"); setSaving(false); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Approve Order #{orderId}</h3>
        <p className="text-sm text-gray-500 mb-4">Set the estimated food-ready time.</p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ready by</label>
        <input
          type="datetime-local"
          value={readyTime}
          onChange={(e) => setReadyTime(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Check className="h-4 w-4" />
            {saving ? "Saving…" : "Confirm Approval"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

interface RejectModalProps {
  orderId: number;
  onClose: () => void;
  onReject: (id: number, reason: string) => Promise<ActionResult>;
}

function RejectModal({ orderId, onClose, onReject }: RejectModalProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  async function submit() {
    if (!reason.trim()) { setErr("Please enter a rejection reason."); return; }
    setSaving(true);
    setErr("");
    const result = await onReject(orderId, reason.trim());
    if (!result.ok) { setErr(result.error ?? "Failed to reject"); setSaving(false); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Reject Order #{orderId}</h3>
        <p className="text-sm text-gray-500 mb-4">Tell the customer why we cannot fulfil this order.</p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
        <textarea
          ref={ref}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Fully booked for the requested time"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
        {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <X className="h-4 w-4" />
            {saving ? "Saving…" : "Confirm Rejection"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────

interface DetailModalProps {
  order: AdminOrder;
  onClose: () => void;
  onApprove: (id: number, estimatedReady: string) => Promise<ActionResult>;
  onReject: (id: number, reason: string) => Promise<ActionResult>;
  onMarkReady: (id: number) => Promise<ActionResult>;
  onConfirmPayment: (id: number) => Promise<ActionResult>;
  cafeName: string;
}

function DetailModal({
  order,
  onClose,
  onApprove,
  onReject,
  onMarkReady,
  onConfirmPayment,
  cafeName,
}: DetailModalProps) {
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [acting, setActing] = useState(false);
  const [err, setErr] = useState("");

  const isPending = order.status === "pending_approval" || order.status === "pending";
  const isPreparing = order.status === "preparing";
  const isPaymentUploaded = order.status === "payment_uploaded";

  function handlePrint() {
    window.print();
  }

  async function handleMarkReady() {
    setActing(true);
    setErr("");
    const r = await onMarkReady(order.id);
    if (!r.ok) setErr(r.error ?? "Failed");
    setActing(false);
    if (r.ok) onClose();
  }

  async function handleConfirmPayment() {
    setActing(true);
    setErr("");
    const r = await onConfirmPayment(order.id);
    if (!r.ok) setErr(r.error ?? "Failed");
    setActing(false);
    if (r.ok) onClose();
  }

  return (
    <>
      {/* Print receipt area — only visible when printing */}
      <div id="receipt-print" className="hidden print:block p-8 font-mono text-black text-sm max-w-[80mm] mx-auto">
        <div className="text-center mb-4">
          <p className="font-bold text-base">{cafeName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{new Date().toLocaleString("en-MY")}</p>
        </div>
        <p className="text-center font-bold text-lg mb-3">Order #{order.id}</p>
        <div className="border-t border-dashed border-gray-400 my-2" />
        <ul className="space-y-1 mb-3">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between">
              <span>{item.quantity}× {item.name}</span>
              <span>RM {(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-dashed border-gray-400 my-2" />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>RM {Number(order.total).toFixed(2)}</span>
        </div>
        {order.contact_number && (
          <p className="mt-3 text-xs text-gray-500">Contact: {order.contact_number}</p>
        )}
        {order.estimated_arrival && (
          <p className="text-xs text-gray-500">ETA: {formatTime(order.estimated_arrival)}</p>
        )}
        <p className="mt-4 text-center text-xs text-gray-400">Thank you!</p>
      </div>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <span className="text-xl font-black text-gray-900">#{order.id}</span>
              <span className={cn(
                "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
              )}>
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
            </div>
            <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* Customer info */}
            <div className="space-y-1 text-sm text-gray-700">
              {order.contact_number && (
                <p><span className="text-gray-500">Phone:</span> {order.contact_number}</p>
              )}
              <p><span className="text-gray-500">Placed:</span> {formatDateTimeCompact(order.created_at)}</p>
              {order.estimated_arrival && (
                <p className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-gray-500">ETA:</span> {formatDateTimeCompact(order.estimated_arrival)}
                </p>
              )}
              {order.estimated_ready && (
                <p><span className="text-gray-500">Ready by:</span> {formatTime(order.estimated_ready)}</p>
              )}
              {order.rejection_reason && (
                <p className="text-red-600">Rejected: {order.rejection_reason}</p>
              )}
            </div>

            {/* Items */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Items</h4>
              <ul className="space-y-1.5">
                {order.items.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="text-gray-800">{item.quantity}× {item.name}</span>
                    <span className="text-gray-500">RM {(item.price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Total */}
            <div className="flex justify-between font-bold text-sm border-t pt-3">
              <span>Total</span>
              <span>RM {Number(order.total).toFixed(2)}</span>
            </div>

            {/* Payment screenshot */}
            {order.payment_screenshot_url && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Payment Screenshot</h4>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.payment_screenshot_url}
                  alt="Payment screenshot"
                  className="w-full rounded-lg border border-gray-200 object-contain max-h-48"
                />
              </div>
            )}

            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>

          {/* Footer actions */}
          <div className="border-t px-5 py-4 space-y-2">
            {/* Print receipt */}
            <button
              onClick={handlePrint}
              className="flex w-full items-center justify-center gap-2 min-h-[44px] rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" />
              Print Receipt
            </button>

            {isPending && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowApprove(true)}
                  className="flex-1 min-h-[44px] rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Approve
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  className="flex-1 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-1.5"
                >
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            )}

            {isPaymentUploaded && (
              <button
                onClick={() => void handleConfirmPayment()}
                disabled={acting}
                className="w-full min-h-[44px] rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                {acting ? "Saving…" : "Confirm Payment"}
              </button>
            )}

            {isPreparing && (
              <button
                onClick={() => void handleMarkReady()}
                disabled={acting}
                className="w-full min-h-[44px] rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                {acting ? "Saving…" : "Mark Ready 🎉"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showApprove && (
        <ApproveModal
          orderId={order.id}
          items={order.items}
          onClose={() => setShowApprove(false)}
          onApprove={async (id, time) => {
            const r = await onApprove(id, time);
            if (r.ok) onClose();
            return r;
          }}
        />
      )}
      {showReject && (
        <RejectModal
          orderId={order.id}
          onClose={() => setShowReject(false)}
          onReject={async (id, reason) => {
            const r = await onReject(id, reason);
            if (r.ok) onClose();
            return r;
          }}
        />
      )}
    </>
  );
}

// ─── POS Order Card ───────────────────────────────────────────────────────────

interface PosCardProps {
  order: AdminOrder;
  onTap: () => void;
  onApprove: (id: number, estimatedReady: string) => Promise<ActionResult>;
  onReject: (id: number, reason: string) => Promise<ActionResult>;
  onMarkReady: (id: number) => Promise<ActionResult>;
  onConfirmPayment: (id: number) => Promise<ActionResult>;
  posMode: "builtin" | "feedme_manual";
  escalationMinutes?: number;
}

function PosCard({ order, onTap, onApprove, onReject, onMarkReady, onConfirmPayment, posMode, escalationMinutes = 10 }: PosCardProps) {
  const [elapsed, setElapsed] = useState(elapsedMinutes(order.created_at));
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setElapsed(elapsedMinutes(order.created_at)), 60_000);
    return () => clearInterval(t);
  }, [order.created_at]);

  const [feedmeEntered, setFeedmeEntered] = useState<boolean>(order.feedme_entered ?? false);
  const [feedmeLoading, setFeedmeLoading] = useState(false);

  const isPending = order.status === "pending_approval" || order.status === "pending";
  const isPreparing = order.status === "preparing";
  const isPaymentUploaded = order.status === "payment_uploaded";
  const isApproved = order.status === "approved";
  const needsFeedmeCheck = posMode === "feedme_manual" && isPreparing && !feedmeEntered;
  const isOverdue = isPending && elapsed >= escalationMinutes;

  async function handleFeedmeEntered(checked: boolean) {
    if (!checked) return;
    setFeedmeLoading(true);
    try {
      await fetch(`/api/admin/orders/${order.id}`, {
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

  async function handleMarkReady(e: React.MouseEvent) {
    e.stopPropagation();
    setActing(true);
    await onMarkReady(order.id);
    setActing(false);
  }

  async function handleConfirmPayment(e: React.MouseEvent) {
    e.stopPropagation();
    setActing(true);
    await onConfirmPayment(order.id);
    setActing(false);
  }

  return (
    <>
      <div
        onClick={onTap}
        className={cn(
          "rounded-xl border bg-white shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow space-y-2",
          isPending && !isOverdue && "border-yellow-300 bg-yellow-50/40",
          isOverdue && "border-red-400 bg-red-50/30",
          isApproved && "border-blue-200",
          isPreparing && "border-orange-200",
          order.status === "ready" && "border-purple-200 bg-purple-50/20"
        )}
      >
        {/* OVERDUE badge */}
        {isOverdue && (
          <div className="flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
            <AlertTriangle className="h-3 w-3" />
            Overdue {elapsed}m
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-lg text-gray-900">#{order.id}</span>
            {order.notification_status === "failed" && (
              <span title="Notification failed"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /></span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">{elapsed}m ago</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-300" />
          </div>
        </div>

        {/* Status badge */}
        <span className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
          STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
        )}>
          {STATUS_LABELS[order.status] ?? order.status}
        </span>

        {/* Items (max 3 shown) */}
        <ul className="text-sm text-gray-700 space-y-0.5">
          {order.items.slice(0, 3).map((item, i) => (
            <li key={i} className="flex justify-between">
              <span>{item.quantity}× {item.name}</span>
            </li>
          ))}
          {order.items.length > 3 && (
            <li className="text-xs text-gray-400">+{order.items.length - 3} more…</li>
          )}
        </ul>

        {/* Total + Contact + ETA */}
        <div className="flex items-center justify-between text-sm pt-1 border-t">
          <span className="font-bold text-gray-900">RM {Number(order.total).toFixed(2)}</span>
          {order.contact_number && (
            <span className="text-xs text-gray-400 truncate max-w-[100px]">{order.contact_number}</span>
          )}
        </div>
        {order.estimated_arrival && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ETA {formatTime(order.estimated_arrival)}
          </p>
        )}

        {/* Action buttons — stop propagation so tapping them doesn't open modal */}
        {isPending && (
          <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowApprove(true); }}
              className="flex-1 min-h-[44px] rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-1"
            >
              <Check className="h-4 w-4" /> Approve
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowReject(true); }}
              className="flex-1 min-h-[44px] rounded-lg bg-red-100 text-red-700 text-sm font-semibold hover:bg-red-200 flex items-center justify-center gap-1"
            >
              <X className="h-4 w-4" /> Reject
            </button>
          </div>
        )}

        {isPaymentUploaded && (
          <div onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => void handleConfirmPayment(e)}
              disabled={acting}
              className="w-full min-h-[44px] rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Eye className="h-4 w-4" />
              {acting ? "Saving…" : "Confirm Payment"}
            </button>
          </div>
        )}

        {isPreparing && (
          <div onClick={(e) => e.stopPropagation()} className="space-y-2">
            {posMode === "feedme_manual" && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-300 px-3 py-2">
                <p className="text-xs font-semibold text-yellow-800 mb-1.5">Enter this order into FeedMe POS</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={feedmeEntered}
                    onChange={(e) => void handleFeedmeEntered(e.target.checked)}
                    disabled={feedmeLoading || feedmeEntered}
                    className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                  />
                  <span className="text-xs text-yellow-900">
                    {feedmeEntered ? "✓ Entered into FeedMe" : feedmeLoading ? "Saving…" : "Entered into FeedMe POS"}
                  </span>
                </label>
              </div>
            )}
            <button
              onClick={(e) => void handleMarkReady(e)}
              disabled={acting || needsFeedmeCheck}
              title={needsFeedmeCheck ? "Please enter into FeedMe POS first" : undefined}
              className="w-full min-h-[44px] rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {acting ? "Saving…" : "Mark Ready 🎉"}
            </button>
          </div>
        )}

        {isApproved && (
          <p className="text-xs text-blue-600 text-center py-1">Awaiting deposit from customer</p>
        )}
      </div>

      {showApprove && (
        <ApproveModal
          orderId={order.id}
          items={order.items}
          onClose={() => setShowApprove(false)}
          onApprove={onApprove}
        />
      )}
      {showReject && (
        <RejectModal
          orderId={order.id}
          onClose={() => setShowReject(false)}
          onReject={onReject}
        />
      )}
    </>
  );
}

// ─── Column header ────────────────────────────────────────────────────────────

const COLUMN_COLORS: Record<Column, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Preparing: "bg-blue-100 text-blue-800",
  Ready: "bg-purple-100 text-purple-800",
};

// ─── Main POS page ────────────────────────────────────────────────────────────

export default function PosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCol, setActiveCol] = useState<Column>("Pending");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [cafeName, setCafeName] = useState("Makan Moments");
  const [posMode, setPosMode] = useState<"builtin" | "feedme_manual">("feedme_manual");
  const [escalationMinutes, setEscalationMinutes] = useState(10);

  // Optimistic update helper
  const updateOrder = useCallback((id: number, changes: Partial<AdminOrder>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...changes } : o)));
  }, []);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) { setError("Failed to load orders"); return; }
      const data: AdminOrder[] = await res.json();
      setOrders(data);
      setError(null);
    } catch {
      if (!silent) setError("Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  // Fetch settings (cafe name + POS mode)
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { cafeName?: string; posMode?: "builtin" | "feedme_manual"; escalationMinutes?: number } | null) => {
        if (d?.cafeName) setCafeName(d.cafeName);
        if (d?.posMode) setPosMode(d.posMode);
        if (typeof d?.escalationMinutes === "number") setEscalationMinutes(d.escalationMinutes);
      })
      .catch(() => {});
  }, []);

  // Initial fetch + 10s auto-refresh
  useEffect(() => {
    void fetchOrders();
    const t = setInterval(() => void fetchOrders(true), 10_000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  // ── API actions ──────────────────────────────────────────────────────────────

  const approveOrder = useCallback(async (id: number, estimatedReady: string): Promise<ActionResult> => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", estimatedReady }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        return { ok: false, error: d.error ?? "Failed to approve" };
      }
      const data = await res.json() as { status: string; estimated_ready: string };
      updateOrder(id, { status: data.status, estimated_ready: data.estimated_ready });
      // Update selected order if open
      setSelectedOrder((prev) => prev?.id === id ? { ...prev, status: data.status, estimated_ready: data.estimated_ready } : prev);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  }, [updateOrder]);

  const rejectOrder = useCallback(async (id: number, reason: string): Promise<ActionResult> => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectionReason: reason }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        return { ok: false, error: d.error ?? "Failed to reject" };
      }
      updateOrder(id, { status: "rejected", rejection_reason: reason });
      setSelectedOrder((prev) => prev?.id === id ? { ...prev, status: "rejected", rejection_reason: reason } : prev);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  }, [updateOrder]);

  const markReady = useCallback(async (id: number): Promise<ActionResult> => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_ready" }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        return { ok: false, error: d.error ?? "Failed" };
      }
      updateOrder(id, { status: "ready" });
      setSelectedOrder((prev) => prev?.id === id ? { ...prev, status: "ready" } : prev);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  }, [updateOrder]);

  const confirmPayment = useCallback(async (id: number): Promise<ActionResult> => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_payment" }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        return { ok: false, error: d.error ?? "Failed" };
      }
      updateOrder(id, { status: "preparing" });
      setSelectedOrder((prev) => prev?.id === id ? { ...prev, status: "preparing" } : prev);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  }, [updateOrder]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const cols: Record<Column, AdminOrder[]> = {
    Pending: orders.filter((o) => getColumn(o) === "Pending"),
    Preparing: orders.filter((o) => getColumn(o) === "Preparing"),
    Ready: orders.filter((o) => getColumn(o) === "Ready"),
  };

  const midnight = todayMidnight();
  const todayOrders = orders.filter((o) => new Date(o.created_at) >= midnight);
  const todayRevenue = todayOrders
    .filter((o) => o.status === "ready" || o.status === "preparing")
    .reduce((sum, o) => sum + Number(o.total), 0);
  const avgOrderValue = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col print:hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <a
            href="/admin/orders"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin
          </a>
          <h1 className="font-bold text-gray-900">POS Dashboard</h1>
        </div>
        <button
          onClick={() => void fetchOrders(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </header>

      {/* Mobile column tabs */}
      <div className="flex border-b bg-white px-1 lg:hidden">
        {COLUMNS.map((col) => (
          <button
            key={col}
            onClick={() => setActiveCol(col)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-b-2",
              activeCol === col
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {col}
            {cols[col].length > 0 && (
              <span className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                COLUMN_COLORS[col]
              )}>
                {cols[col].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-gray-400">Loading orders…</div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => void fetchOrders()}
              className="rounded-lg bg-red-600 px-4 py-2 text-white text-sm hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Desktop: 3-column kanban */}
            <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4">
              {COLUMNS.map((col) => (
                <div key={col} className="flex flex-col min-h-0">
                  <div className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-2 mb-3",
                    col === "Pending" && "bg-yellow-50 border border-yellow-200",
                    col === "Preparing" && "bg-blue-50 border border-blue-200",
                    col === "Ready" && "bg-purple-50 border border-purple-200"
                  )}>
                    <h2 className="font-bold text-sm text-gray-800">{col}</h2>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold",
                      COLUMN_COLORS[col]
                    )}>
                      {cols[col].length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {cols[col].length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                        No {col.toLowerCase()} orders
                      </div>
                    ) : (
                      cols[col].map((order) => (
                        <PosCard
                          key={order.id}
                          order={order}
                          onTap={() => setSelectedOrder(order)}
                          onApprove={approveOrder}
                          onReject={rejectOrder}
                          onMarkReady={markReady}
                          onConfirmPayment={confirmPayment}
                          posMode={posMode}
                          escalationMinutes={escalationMinutes}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile: single column tab view */}
            <div className="lg:hidden space-y-3">
              {cols[activeCol].length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
                  No {activeCol.toLowerCase()} orders
                </div>
              ) : (
                cols[activeCol].map((order) => (
                  <PosCard
                    key={order.id}
                    order={order}
                    onTap={() => setSelectedOrder(order)}
                    onApprove={approveOrder}
                    onReject={rejectOrder}
                    onMarkReady={markReady}
                    onConfirmPayment={confirmPayment}
                    posMode={posMode}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Daily summary footer */}
      <footer className="border-t bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600 max-w-2xl mx-auto">
          <span>
            <span className="font-bold text-gray-900">{todayOrders.length}</span> orders today
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Revenue: <span className="font-bold text-gray-900">RM {todayRevenue.toFixed(2)}</span>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Avg: <span className="font-bold text-gray-900">RM {avgOrderValue.toFixed(2)}</span>
          </span>
        </div>
      </footer>

      {/* Detail modal */}
      {selectedOrder && (
        <DetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onApprove={approveOrder}
          onReject={rejectOrder}
          onMarkReady={markReady}
          onConfirmPayment={confirmPayment}
          cafeName={cafeName}
        />
      )}
    </div>
  );
}

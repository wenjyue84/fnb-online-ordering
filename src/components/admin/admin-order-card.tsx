"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, Clock, Eye, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTimeCompact as formatDateTime, formatTime } from "@/lib/date-utils";
import type { AdminOrder, ActionResult } from "@/hooks/useAdminOrders";
import { calculateSmartReadyTime, toDatetimeLocal } from "@/lib/orders";

export const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  payment_pending: "Awaiting Payment",
  payment_uploaded: "Payment Uploaded",
  preparing: "Preparing",
  ready: "Ready",
  expired: "Expired",
  seen: "Seen",
  pending: "Pending",
};

export const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  payment_pending: "bg-orange-100 text-orange-800",
  payment_uploaded: "bg-violet-100 text-violet-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-purple-100 text-purple-800",
  expired: "bg-stone-100 text-stone-600",
  seen: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-800",
};

// ---------------------------------------------------------------------------
// Approve modal
// ---------------------------------------------------------------------------
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Approve Order #{orderId}</h3>
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
            className="flex-1 min-h-[40px] rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Check className="h-4 w-4" />
            {saving ? "Saving…" : "Confirm Approval"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="min-h-[40px] rounded-lg border border-gray-300 px-4 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reject modal
// ---------------------------------------------------------------------------
interface RejectModalProps {
  orderId: number;
  onClose: () => void;
  onReject: (id: number, reason: string) => Promise<ActionResult>;
}

function RejectModal({ orderId, onClose, onReject }: RejectModalProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textRef.current?.focus(); }, []);

  async function submit() {
    if (!reason.trim()) { setErr("Please enter a rejection reason."); return; }
    setSaving(true);
    setErr("");
    const result = await onReject(orderId, reason.trim());
    if (!result.ok) { setErr(result.error ?? "Failed to reject"); setSaving(false); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Reject Order #{orderId}</h3>
        <p className="text-sm text-gray-500 mb-4">Tell the customer why we cannot fulfil this order.</p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
        <textarea
          ref={textRef}
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
            className="flex-1 min-h-[40px] rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <X className="h-4 w-4" />
            {saving ? "Saving…" : "Confirm Rejection"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="min-h-[40px] rounded-lg border border-gray-300 px-4 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment view modal
// ---------------------------------------------------------------------------
interface PaymentModalProps {
  orderId: number;
  screenshotUrl: string;
  onClose: () => void;
  onStatusUpdate: (id: number, action: "confirm_payment" | "mark_ready" | "reject_payment", extra?: { reason?: string }) => Promise<ActionResult>;
}

function PaymentModal({ orderId, screenshotUrl, onClose, onStatusUpdate }: PaymentModalProps) {
  const [saving, setSaving] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  async function confirmPayment() {
    setSaving(true);
    setErr("");
    const result = await onStatusUpdate(orderId, "confirm_payment");
    if (!result.ok) { setErr(result.error ?? "Failed to confirm payment"); setSaving(false); return; }
    onClose();
  }

  async function rejectPayment() {
    if (!reason.trim()) { setErr("Please enter a reason."); return; }
    setSaving(true);
    setErr("");
    const result = await onStatusUpdate(orderId, "reject_payment", { reason: reason.trim() });
    if (!result.ok) { setErr(result.error ?? "Failed to reject payment"); setSaving(false); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Payment Screenshot</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={screenshotUrl}
          alt="Payment screenshot"
          className="w-full rounded-lg border border-gray-200 object-contain max-h-64"
        />

        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

        {!rejectMode ? (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void confirmPayment()}
              disabled={saving}
              className="flex-1 min-h-[40px] rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              {saving ? "Saving…" : "Confirm Payment ✓"}
            </button>
            <button
              onClick={() => setRejectMode(true)}
              disabled={saving}
              className="min-h-[40px] rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 px-3 disabled:opacity-50 transition-colors"
            >
              Reject ✗
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for rejection</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Screenshot unclear, wrong amount"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => void rejectPayment()}
                disabled={saving}
                className="flex-1 min-h-[40px] rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <X className="h-4 w-4" />
                {saving ? "Saving…" : "Confirm Rejection"}
              </button>
              <button
                onClick={() => { setRejectMode(false); setErr(""); }}
                disabled={saving}
                className="min-h-[40px] rounded-lg border border-gray-300 px-3 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminOrderCard — public export
// ---------------------------------------------------------------------------
export interface AdminOrderCardProps {
  order: AdminOrder;
  posMode?: "builtin" | "feedme_manual";
  escalationMinutes?: number;
  onApprove: (id: number, estimatedReady: string) => Promise<ActionResult>;
  onReject: (id: number, reason: string) => Promise<ActionResult>;
  onStatusUpdate: (id: number, action: "confirm_payment" | "mark_ready" | "reject_payment", extra?: { reason?: string }) => Promise<ActionResult>;
}

export function AdminOrderCard({ order, posMode = "feedme_manual", escalationMinutes = 10, onApprove, onReject, onStatusUpdate }: AdminOrderCardProps) {
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [feedmeEntered, setFeedmeEntered] = useState<boolean>(order.feedme_entered ?? false);
  const [feedmeLoading, setFeedmeLoading] = useState(false);

  const isPending = order.status === "pending_approval" || order.status === "pending";
  const hasPaymentUploaded = order.status === "payment_uploaded";
  const isOverdue = isPending && (Date.now() - new Date(order.created_at).getTime()) > escalationMinutes * 60_000;
  const isPreparing = order.status === "preparing";
  const needsFeedmeCheck = posMode === "feedme_manual" && isPreparing && !feedmeEntered;

  async function handleMarkReady() {
    setMarkingReady(true);
    await onStatusUpdate(order.id, "mark_ready");
    setMarkingReady(false);
  }

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

  return (
    <>
      <div className={cn(
        "rounded-xl border bg-white shadow-sm p-4 flex flex-col gap-3",
        isPending && "border-yellow-300 bg-yellow-50/40",
        isOverdue && "border-red-400 bg-red-50/30"
      )}>
        {/* OVERDUE banner */}
        {isOverdue && (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Overdue — waiting {escalationMinutes}+ min
          </div>
        )}

        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-mono text-gray-400">#{order.id}</span>
            <span className={cn(
              "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
              STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
            )}>
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
            {order.notification_status === "failed" && (
              <span
                className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700"
                title="WhatsApp notification failed after 3 retries"
              >
                <AlertTriangle className="h-3 w-3" />
                WA Failed
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0">{formatDateTime(order.created_at)}</span>
        </div>

        {/* Customer info */}
        <div className="text-sm text-gray-700 space-y-0.5">
          {order.contact_number && (
            <p><span className="text-gray-500">Phone:</span> {order.contact_number}</p>
          )}
          {order.estimated_arrival && (
            <p className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-500">ETA:</span> {formatDateTime(order.estimated_arrival)}
            </p>
          )}
          {order.estimated_ready && (
            <p><span className="text-gray-500">Ready by:</span> {formatTime(order.estimated_ready)}</p>
          )}
          {order.rejection_reason && (
            <p className="text-red-600 text-xs mt-1">Rejected: {order.rejection_reason}</p>
          )}
        </div>

        {/* Items */}
        <ul className="text-sm text-gray-800 space-y-0.5 border-t pt-2">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between">
              <span>{item.quantity}× {item.name}</span>
              <span className="text-gray-500">RM {(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>

        {/* Total */}
        <div className="flex justify-between font-semibold text-sm border-t pt-2">
          <span>Total</span>
          <span>RM {Number(order.total).toFixed(2)}</span>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowApprove(true)}
              className="flex-1 min-h-[40px] rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4" /> Approve
            </button>
            <button
              onClick={() => setShowReject(true)}
              className="flex-1 min-h-[40px] rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="h-4 w-4" /> Reject
            </button>
          </div>
        )}

        {hasPaymentUploaded && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowPayment(true)}
              className="flex-1 min-h-[40px] rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Eye className="h-4 w-4" /> View Payment
            </button>
          </div>
        )}

        {isPreparing && (
          <div className="flex flex-col gap-2 pt-1">
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
              onClick={() => void handleMarkReady()}
              disabled={markingReady || needsFeedmeCheck}
              title={needsFeedmeCheck ? "Please enter into FeedMe POS first" : undefined}
              className="flex-1 min-h-[40px] rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              {markingReady ? "Saving…" : "Mark Ready 🎉"}
            </button>
          </div>
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
      {showPayment && order.payment_screenshot_url && (
        <PaymentModal
          orderId={order.id}
          screenshotUrl={order.payment_screenshot_url}
          onClose={() => setShowPayment(false)}
          onStatusUpdate={onStatusUpdate}
        />
      )}
    </>
  );
}

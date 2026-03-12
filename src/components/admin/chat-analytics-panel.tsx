"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, BarChart3 } from "lucide-react";

interface AnalyticsData {
  upCount: number;
  downCount: number;
  total: number;
  upPercent: number;
  recent: Array<{
    id: number;
    session_id: string | null;
    message_index: number;
    rating: string;
    created_at: string;
  }>;
}

export default function ChatAnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/chat-analytics", { credentials: "include" })
      .then((r) => r.json())
      .then((d: AnalyticsData) => setData(d))
      .catch(() => setData({ upCount: 0, downCount: 0, total: 0, upPercent: 0, recent: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 opacity-30" />
        <p className="text-lg font-medium">No chat feedback collected yet</p>
        <p className="text-sm">
          Feedback will appear here once customers rate AI waiter responses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            Total Feedback
          </div>
          <p className="mt-1 text-2xl font-bold">{data.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <ThumbsUp className="h-4 w-4" />
            Positive
          </div>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {data.upCount}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({data.upPercent}%)
            </span>
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-red-500">
            <ThumbsDown className="h-4 w-4" />
            Negative
          </div>
          <p className="mt-1 text-2xl font-bold text-red-500">
            {data.downCount}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({data.total > 0 ? 100 - data.upPercent : 0}%)
            </span>
          </p>
        </div>
      </div>

      {/* Satisfaction bar */}
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-2 text-sm font-medium">Satisfaction Rate</p>
        <div className="flex h-4 overflow-hidden rounded-full bg-muted">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${data.upPercent}%` }}
          />
          <div
            className="bg-red-400 transition-all"
            style={{ width: `${100 - data.upPercent}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{data.upPercent}% positive</span>
          <span>{100 - data.upPercent}% negative</span>
        </div>
      </div>

      {/* Recent feedback table */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h3 className="font-medium">Recent Feedback (Last 50)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Session</th>
                <th className="px-4 py-2 text-left font-medium">Message #</th>
                <th className="px-4 py-2 text-left font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString("en-MY", {
                      timeZone: "Asia/Kuala_Lumpur",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {entry.session_id ? entry.session_id.slice(0, 16) : "—"}
                  </td>
                  <td className="px-4 py-2">{entry.message_index}</td>
                  <td className="px-4 py-2">
                    {entry.rating === "up" ? (
                      <ThumbsUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

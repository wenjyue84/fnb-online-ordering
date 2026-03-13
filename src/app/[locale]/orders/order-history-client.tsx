"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ShoppingCart, ExternalLink } from "lucide-react";

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
  status: "pending" | "approved" | "preparing" | "ready" | "rejected";
}

const ORDER_HISTORY_KEY = "mm_order_history";
const MAX_DISPLAY = 20;

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const config: Record<string, { bg: string; label: string }> = {
    ready: { bg: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200", label: t("statusReady") },
    approved: { bg: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200", label: t("statusApproved") },
    preparing: { bg: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200", label: t("statusPreparing") },
    rejected: { bg: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200", label: t("statusRejected") },
  };
  const c = config[status] ?? { bg: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200", label: t("statusPending") };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.bg}`}>
      {c.label}
    </span>
  );
}

export function OrderHistoryClient() {
  const t = useTranslations("orderHistoryPage");
  const locale = useLocale();
  const [orders, setOrders] = useState<OrderHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OrderHistoryEntry[];
        if (Array.isArray(parsed)) {
          setOrders(parsed.slice(0, MAX_DISPLAY));
        }
      }
    } catch {
      // corrupted storage — ignore
    }
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <div className="mt-12 flex flex-col items-center text-center">
          <ShoppingCart className="h-16 w-16 text-muted-foreground/40" />
          <h2 className="mt-4 text-lg font-semibold text-muted-foreground">{t("emptyTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyDesc")}</p>
          <Link
            href="/menu"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t("browseMenu")}
          </Link>
        </div>
      </div>
    );
  }

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "zh" ? "zh-MY" : locale === "ms" ? "ms-MY" : "en-MY",
    { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>

      <div className="mt-6 space-y-4">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/order/${order.id}`}
            className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-primary">
                {t("orderNumber", { id: order.id })}
              </span>
              <StatusBadge status={order.status} t={t} />
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {dateFormatter.format(new Date(order.timestamp))}
            </p>

            <div className="mt-3 space-y-1">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="text-muted-foreground">
                    RM {(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2">
              <span className="text-sm font-bold">
                {t("total")}: RM {order.total.toFixed(2)}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                {t("trackOrder")} <ExternalLink className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

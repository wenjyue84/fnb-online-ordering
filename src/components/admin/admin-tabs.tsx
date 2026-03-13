"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  UtensilsCrossed,
  Tag,
  Shield,
  BookOpen,
  FlaskConical,
  ShoppingBag,
  Settings,
  Menu,
  X,
  LogOut,
  Monitor,
  Bot,
  BarChart3,
  Eye,
  LayoutDashboard,
} from "lucide-react";

const KDS_URL = process.env.NEXT_PUBLIC_KDS_URL ?? "/kds";
import type { MenuItemWithRules } from "@/types/menu";
import type { BlogPost } from "@/types/blog";
import { cn } from "@/lib/utils";

const LoadingPlaceholder = () => (
  <div className="space-y-4 p-6">
    <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
    <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
  </div>
);

const AdminMenuTable = dynamic(
  () => import("./admin-menu-table").then((m) => m.AdminMenuTable),
  { ssr: false, loading: LoadingPlaceholder }
);
const AdminCategoriesPanel = dynamic(
  () => import("./admin-categories-panel").then((m) => m.AdminCategoriesPanel),
  { ssr: false, loading: LoadingPlaceholder }
);
const AdminBlogTable = dynamic(
  () => import("./admin-blog-table").then((m) => m.AdminBlogTable),
  { ssr: false, loading: LoadingPlaceholder }
);
const AdminRulesPanel = dynamic(
  () => import("./admin-rules-panel").then((m) => m.AdminRulesPanel),
  { ssr: false, loading: LoadingPlaceholder }
);
const AdminTestsPanel = dynamic(
  () => import("./admin-tests-panel").then((m) => m.AdminTestsPanel),
  { ssr: false, loading: LoadingPlaceholder }
);
const AdminSettingsPanel = dynamic(
  () => import("./admin-settings-panel").then((m) => m.AdminSettingsPanel),
  { ssr: false, loading: LoadingPlaceholder }
);
const AdminOrdersPanel = dynamic(
  () => import("./admin-orders-panel").then((m) => m.AdminOrdersPanel),
  { ssr: false, loading: LoadingPlaceholder }
);
const AiWaiterPage = dynamic(
  () => import("./ai-waiter-page").then((m) => m.AiWaiterPage),
  { ssr: false, loading: LoadingPlaceholder }
);
const ChatAnalyticsPanel = dynamic(
  () => import("./chat-analytics-panel"),
  { ssr: false, loading: LoadingPlaceholder }
);

interface AdminTabsProps {
  items: MenuItemWithRules[];
  displayCategories: string[];
  posts: BlogPost[];
}

const TABS = [
  "Orders",
  "POS",
  "Menu",
  "Preview",
  "Categories",
  "Rules",
  "Blog",
  "Tests",
  "Settings",
  "Chat Analytics",
  "KDS",
  "AI Waiter",
] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  Orders: <ShoppingBag className="h-4 w-4 shrink-0" />,
  POS: <LayoutDashboard className="h-4 w-4 shrink-0" />,
  "AI Waiter": <Bot className="h-4 w-4 shrink-0" />,
  Menu: <UtensilsCrossed className="h-4 w-4 shrink-0" />,
  Preview: <Eye className="h-4 w-4 shrink-0" />,
  Categories: <Tag className="h-4 w-4 shrink-0" />,
  Rules: <Shield className="h-4 w-4 shrink-0" />,
  Blog: <BookOpen className="h-4 w-4 shrink-0" />,
  Tests: <FlaskConical className="h-4 w-4 shrink-0" />,
  Settings: <Settings className="h-4 w-4 shrink-0" />,
  "Chat Analytics": <BarChart3 className="h-4 w-4 shrink-0" />,
  KDS: <Monitor className="h-4 w-4 shrink-0" />,
};

const TAB_SLUGS: Record<Tab, string> = {
  Orders: "orders",
  POS: "pos",
  "AI Waiter": "ai-waiter",
  Menu: "menu",
  Preview: "preview",
  Categories: "categories",
  Rules: "rules",
  Blog: "blog",
  Tests: "tests",
  Settings: "settings",
  "Chat Analytics": "chat-analytics",
  KDS: "kds",
};

const SLUG_TO_TAB: Record<string, Tab> = {
  orders: "Orders",
  "ai-waiter": "AI Waiter",
  menu: "Menu",
  categories: "Categories",
  rules: "Rules",
  blog: "Blog",
  tests: "Tests",
  settings: "Settings",
  "chat-analytics": "Chat Analytics",
};

export function AdminTabs({ items, displayCategories, posts }: AdminTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  // Derive active tab from URL segment
  const slug = pathname.split("/").pop() ?? "";
  const activeTab: Tab = SLUG_TO_TAB[slug] ?? "Menu";

  const handleTabClick = (tab: Tab) => {
    if (tab === "Preview") {
      window.open("/en/menu", "_blank");
      setSidebarOpen(false);
      return;
    }
    if (tab === "KDS") {
      window.open(KDS_URL, "_blank");
      setSidebarOpen(false);
      return;
    }
    if (tab === "POS") {
      window.open("/pos", "_blank");
      setSidebarOpen(false);
      return;
    }
    if (tab === "AI Waiter") {
      window.open("/admin/ai-waiter-hub", "_blank");
      setSidebarOpen(false);
      return;
    }
    router.push(`/admin/${TAB_SLUGS[tab]}`);
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-52 shrink-0 border-r bg-white transition-transform lg:static lg:translate-x-0 lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Mobile close button */}
          <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
            <span className="text-sm font-semibold text-gray-700">Navigation</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto py-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                  activeTab === tab
                    ? "border-l-2 border-orange-500 bg-orange-50 text-orange-600"
                    : "border-l-2 border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                {TAB_ICONS[tab]}
                <span>{tab}</span>
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="border-t px-3 py-3">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded px-2 py-2 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile hamburger header */}
        <div className="flex items-center gap-3 border-b bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded p-1 text-gray-600 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-gray-700">{activeTab}</span>
        </div>

        {/* Content area */}
        <main className={activeTab === "AI Waiter" ? "flex-1 p-2" : "flex-1 p-6"}>
          {activeTab === "Orders" && <AdminOrdersPanel />}
          {activeTab === "AI Waiter" && <AiWaiterPage />}
          {activeTab === "Menu" && (
            <AdminMenuTable initialItems={items} displayCategories={displayCategories} />
          )}
          {activeTab === "Categories" && (
            <AdminCategoriesPanel allItems={items} />
          )}
          {activeTab === "Rules" && <AdminRulesPanel displayCategories={displayCategories} />}
          {activeTab === "Blog" && <AdminBlogTable initialPosts={posts} />}
          {activeTab === "Tests" && <AdminTestsPanel />}
          {activeTab === "Settings" && <AdminSettingsPanel displayCategories={displayCategories} />}
          {activeTab === "Chat Analytics" && <ChatAnalyticsPanel />}
        </main>
      </div>
    </div>
  );
}

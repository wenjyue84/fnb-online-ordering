import { getAllMenuItemsWithRulesForAdmin, getDisplayCategories } from "@/lib/menu";
import { getAllBlogPostsForAdmin } from "@/lib/blog";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { AdminOrdersBell } from "@/components/admin/admin-orders-bell";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const VALID_TABS = ["orders", "ai-waiter", "menu", "categories", "rules", "blog", "tests", "settings"];

export default async function AdminTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const valid = token ? await verifyAdminToken(token) : false;
  if (!valid) redirect("/admin/login");

  const { tab } = await params;
  if (!VALID_TABS.includes(tab)) redirect("/admin/menu");

  const [items, displayCategories, posts, settings] = await Promise.all([
    getAllMenuItemsWithRulesForAdmin(),
    getDisplayCategories(),
    getAllBlogPostsForAdmin(),
    getSiteSettings(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between gap-2">
        <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">{settings.cafeName} Admin</h1>
        <div className="flex items-center gap-2">
          <AdminOrdersBell />
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <AdminTabs items={items} displayCategories={displayCategories.filter((dc) => dc.active).map((dc) => dc.name)} posts={posts} />
      </main>
    </div>
  );
}

function SignOutButton() {
  return (
    <form action="/api/admin/logout" method="POST">
      <button
        type="submit"
        className="min-h-[44px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        Sign Out
      </button>
    </form>
  );
}

import { readChatSettings } from "@/lib/chat/settings";
import { ChatSettingsPanel } from "@/components/admin/chat-settings-panel";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChatSettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const valid = token ? await verifyAdminToken(token) : false;
  if (!valid) redirect("/admin/login");

  const settings = await readChatSettings();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Admin
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">AI Waiter Settings</h1>
        </div>
        <SignOutButton />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="mb-8 text-sm text-gray-500">
          Configure the AI waiter&apos;s system prompt, model provider, and
          response style. Changes take effect immediately on the next chat
          message — no restart required.
        </p>
        <ChatSettingsPanel initialSettings={settings} />
      </main>
    </div>
  );
}

function SignOutButton() {
  return (
    <form action="/api/admin/logout" method="POST">
      <button
        type="submit"
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        Sign Out
      </button>
    </form>
  );
}

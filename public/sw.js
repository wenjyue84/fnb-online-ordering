// Makan Moments Cafe — Service Worker
// Handles: push notifications + basic shell caching

const CACHE_NAME = "makan-moments-v2";
const SHELL_URLS = ["/en", "/ms", "/zh", "/manifest.webmanifest", "/offline.html"];

// Install: pre-cache shell URLs; wait for SKIP_WAITING message before activating
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {
        // Shell caching is best-effort; don't block install on failure
      })
  );
  // Do NOT call self.skipWaiting() here — wait for the client to send SKIP_WAITING
  // so the app can prompt the user before updating (US-611)
});

// Message: handle SKIP_WAITING from the update banner
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback for navigation requests
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then(
          (cached) => cached || caches.match("/offline.html")
        )
      )
    );
  }
});

// Push: show notification when server sends a push event
self.addEventListener("push", (event) => {
  let data = { title: "Makan Moments", body: "New order received!" };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    // fallback to defaults
  }

  const isUrgent = data.priority === "urgent";

  const options = {
    body: data.body,
    icon: "/images/logo.png",
    badge: "/images/logo.png",
    tag: data.tag || "new-order",
    requireInteraction: true,
    data: { url: data.url || "/admin" },
    ...(isUrgent && { vibrate: [200, 100, 200, 100, 200] }),
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Makan Moments", options)
  );
});

// NotificationClick: open admin panel when notification is clicked
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/admin";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing admin tab if open
        for (const client of windowClients) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

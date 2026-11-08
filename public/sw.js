/* Cache public offline documents/scripts only; never authenticated HTML or APIs. */
importScripts("/offline-pos-store.js");
const CACHE = "cafe-shell-v3-easy-counter";
const SHELL = [
  "/offline.html",
  "/offline-pos.html",
  "/offline-pos-store.js",
  "/offline-pos.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("cafe-shell-") && k !== CACHE)
              .map((k) => caches.delete(k)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(
          url.pathname === "/admin/pos" || url.pathname === "/offline-pos.html"
            ? "/offline-pos.html"
            : "/offline.html",
        ),
      ),
    );
  else if (SHELL.includes(url.pathname))
    event.respondWith(
      caches
        .match(url.pathname)
        .then((cached) => cached || fetch(event.request)),
    );
});
self.addEventListener("sync", (event) => {
  if (event.tag !== "cafe-counter-outbox") return;
  event.waitUntil(
    (async () => {
      const snapshot = await self.CafeOfflinePOS.snapshot();
      if (!snapshot?.user) return;
      const result = await self.CafeOfflinePOS.sync(snapshot.user.id);
      if (result.pending)
        throw new Error("Counter bills still await confirmation.");
    })(),
  );
});
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Engineer Cafe", {
      body: data.body || "New kitchen ticket",
      icon: "/app-icon/192",
      badge: "/app-icon/192",
      tag: data.tag || "cafe-order",
      data: { url: data.url === "/admin/orders" ? data.url : "/admin/orders" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const url = new URL("/admin/orders", self.location.origin).href;
      const client = list.find((c) =>
        c.url.startsWith(self.location.origin + "/admin"),
      );
      if (client) {
        await client.navigate(url);
        return client.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});

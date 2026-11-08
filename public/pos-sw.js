const CACHE = "engineer-cafe-offline-v1";
const SHELL = ["/pos-offline.html", "/pos-store.js", "/pos-offline.js"];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
// No authenticated HTML, session responses, admin APIs or customer data cached.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || event.request.method !== "GET") return;
  if (
    event.request.mode === "navigate" &&
    (url.pathname === "/admin/pos" || url.pathname === "/pos-offline.html")
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/pos-offline.html")),
    );
  } else if (SHELL.includes(url.pathname)) {
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || fetch(event.request)),
    );
  }
});

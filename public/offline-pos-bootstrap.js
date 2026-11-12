/* Prepare the offline shell before reporting readiness. Never clears IndexedDB. */
(() => {
  const loading = new Map();
  let preparing;
  const status = (text) => {
    const element = document.getElementById("offline-shell-status");
    if (element) element.textContent = text;
  };
  function bounded(promise, message) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(message)), 20000);
      }),
    ]).finally(() => clearTimeout(timer));
  }
  function activated(worker) {
    if (!worker)
      return Promise.reject(
        Error(
          "Offline files are not installed yet. Reconnect and prepare this device again.",
        ),
      );
    return new Promise((resolve, reject) => {
      const check = () => {
        if (worker.state === "activated") {
          worker.removeEventListener("statechange", check);
          resolve();
        } else if (worker.state === "redundant") {
          worker.removeEventListener("statechange", check);
          reject(
            Error(
              "Offline files could not be installed. Stay online and try preparing again.",
            ),
          );
        }
      };
      worker.addEventListener("statechange", check);
      check();
    });
  }
  function prepareShell() {
    if (preparing) return preparing;
    preparing = (async () => {
      if (!("serviceWorker" in navigator) || !window.isSecureContext)
        throw Error(
          "Offline reload needs a supported browser on the cafe HTTPS website. You can keep using online POS.",
        );
      if (!navigator.onLine) {
        if (!navigator.serviceWorker.controller)
          throw Error(
            "Connect to the internet once and prepare this counter before opening it offline.",
          );
        status("Offline files are available on this device.");
        return;
      }
      // A prepared counter must open from disk even when navigator.onLine is
      // true but the WAN is stalled. Update an already-current shell in the
      // background; an older shell still waits for its first upgrade online.
      const existing = await navigator.serviceWorker.getRegistration();
      if (
        existing?.active &&
        !existing.installing &&
        !existing.waiting &&
        "caches" in window
      ) {
        const cache = await caches.open("cafe-shell-v10-simple-counter");
        const files = await Promise.all(
          [
            "/offline-pos.html",
            "/offline-pos-bootstrap.js",
            "/offline-pos-store.js",
            "/offline-pos.js",
            "/offline.html",
            "/offline-home.js",
          ].map((file) => cache.match(file)),
        );
        if (files.every(Boolean)) {
          status("Offline files are ready on this device.");
          void existing.update().catch(() => {});
          return;
        }
      }
      status("Downloading offline files. Keep the internet connected…");
      const registration = await bounded(
        navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }),
        "Offline preparation timed out. Stay online and try again.",
      );
      await bounded(
        activated(
          registration.installing ||
            registration.waiting ||
            registration.active,
        ),
        "Offline files are still downloading. Stay online and prepare this device again.",
      );
      status("Offline files are ready on this device.");
    })()
      .catch((error) => {
        status(error.message);
        throw error;
      })
      .finally(() => {
        preparing = undefined;
      });
    return preparing;
  }
  function script(src) {
    if (!loading.has(src))
      loading.set(
        src,
        new Promise((resolve, reject) => {
          const node = document.createElement("script");
          node.src = src;
          node.onload = resolve;
          node.onerror = () => {
            loading.delete(src);
            reject(
              Error(
                "Counter files could not load. Reconnect and reload this page; saved local bills are retained.",
              ),
            );
          };
          document.head.append(node);
        }),
      );
    return loading.get(src);
  }
  window.CafeOfflineBootstrap = { prepareShell };
  if (document.documentElement.dataset.offlineCounter === "true") {
    (async () => {
      try {
        await prepareShell();
      } catch {
        /* Keep the current page usable; show the cache error above. */
      }
      try {
        await script("/offline-pos-store.js");
        await script("/offline-pos.js");
      } catch (error) {
        const message = document.getElementById("message");
        if (message) message.textContent = error.message;
      }
    })();
  }
})();

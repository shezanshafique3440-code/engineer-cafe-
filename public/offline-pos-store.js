/* Shared IndexedDB outbox for the counter and its service worker. No token/password is stored. */
(() => {
  const scope = globalThis;
  const database = new Promise((resolve, reject) => {
    const request = indexedDB.open("cafe-offline-counter", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("bills", { keyPath: "id" });
      request.result.createObjectStore("meta");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  async function run(name, mode, fn) {
    const db = await database;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(name, mode);
      const req = fn(tx.objectStore(name));
      tx.oncomplete = () => {
        resolve(req.result);
        if (name === "bills" && mode === "readwrite") {
          if (typeof window !== "undefined")
            window.dispatchEvent(new Event("cafe:outbox-changed"));
          try {
            if (typeof BroadcastChannel !== "undefined") {
              const channel = new BroadcastChannel("cafe-offline-counter");
              channel.postMessage({ type: "outbox-changed" });
              channel.close();
            }
          } catch {
            /* Cross-tab hints are optional; the durable write already completed. */
          }
        }
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error("Offline storage aborted."));
    });
  }
  const list = async (ownerId) =>
    (await run("bills", "readonly", (s) => s.getAll()))
      .filter((b) => b.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Keep stalled WAN connections from holding the sync lock indefinitely.
  // A timed-out POST stays pending with the same UUID; it may have committed.
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options.method === "POST" ? 15000 : 5000,
    );
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      const body =
        options.method === "HEAD"
          ? null
          : await response.json().catch(() => null);
      return { response, body };
    } catch {
      throw Error(
        "Connection unavailable. Cash bills remain on this device and will retry automatically.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  function authRequired(message) {
    const error = Error(message);
    error.authRequired = true;
    return error;
  }
  let busy = false;
  async function synchronize(ownerId) {
    if (busy) return { pending: 1 };
    busy = true;
    try {
      const queued = (await list(ownerId)).filter((b) => b.state === "pending");
      if (!queued.length)
        return {
          pending: 0,
          conflicts: (await list(ownerId)).filter((b) => b.state === "conflict")
            .length,
        };
      const { response: auth, body: session } = await request("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (auth.status === 401 || auth.status === 403)
        throw authRequired(
          "Sign in as the original cashier to synchronize these bills.",
        );
      if (!auth.ok || !session || !Object.hasOwn(session, "user"))
        throw Error(
          "The server is temporarily unavailable. Keep taking local cash bills; saved bills will retry.",
        );
      if (!session.user || session.user.id !== ownerId)
        throw authRequired(
          "Sign in as the original cashier to synchronize these bills.",
        );
      const { response: protocol } = await request("/api/admin/offline-pos", {
        method: "HEAD",
        cache: "no-store",
        credentials: "same-origin",
      });
      if (protocol.status === 401 || protocol.status === 403)
        throw authRequired(
          "Sign in with POS access to synchronize these bills. Local bills are retained.",
        );
      if (
        !protocol.ok ||
        protocol.headers.get("X-Cafe-Offline-Protocol") !== "1"
      )
        throw Error(
          "The server cannot confirm offline sync yet. Keep taking local cash bills; saved bills are retained for retry.",
        );
      for (const bill of queued) {
        let response, result;
        try {
          const sent = await request(
            bill.endpoint || "/api/admin/offline-pos",
            {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                bill.endpoint
                  ? bill.payload
                  : { ...bill.payload, offline: true },
              ),
            },
          );
          response = sent.response;
          result = sent.body || {};
        } catch (error) {
          bill.error =
            "Network unavailable. The original bill is retained for retry.";
          await run("bills", "readwrite", (s) => s.put(bill));
          throw error;
        }
        if (response.ok && result.order?.id && result.order?.orderNumber) {
          bill.state = "synced";
          bill.order = result.order;
          bill.error = "";
        } else if (
          response.status === 401 ||
          response.status === 403 ||
          response.status === 404 ||
          response.status >= 500 ||
          response.status === 429 ||
          response.ok
        ) {
          bill.error =
            result.error ||
            "No valid server confirmation yet. Retry uses the same bill ID.";
          await run("bills", "readwrite", (s) => s.put(bill));
          break;
        } else {
          bill.state = "conflict";
          bill.error = result.error || "Review this bill before retrying.";
          bill.errorFields = result.fields || null;
        }
        await run("bills", "readwrite", (s) => s.put(bill));
        if (response.status === 401 || response.status === 403) break;
      }
      const bills = await list(ownerId);
      return {
        pending: bills.filter((b) => b.state === "pending").length,
        conflicts: bills.filter((b) => b.state === "conflict").length,
      };
    } finally {
      busy = false;
    }
  }
  scope.CafeOfflinePOS = {
    list,
    snapshot: async (value) => {
      if (value)
        await run("meta", "readwrite", (s) => s.put(value, "snapshot"));
      return run("meta", "readonly", (s) => s.get("snapshot"));
    },
    clearSnapshot: async () => {
      await run("meta", "readwrite", (s) => s.delete("snapshot"));
      if (typeof BroadcastChannel !== "undefined") {
        const c = new BroadcastChannel("cafe-offline-counter");
        c.postMessage({ type: "logout" });
        c.close();
      }
    },
    queue: async (ownerId, payload, receipt) => {
      if (
        !payload.requestId ||
        !payload.shiftId ||
        !payload.accountId ||
        !payload.lines?.length
      )
        throw new Error(
          "An offline bill requires its UUID, prepared shift, cash account and product lines.",
        );
      const old = await run("bills", "readonly", (s) =>
        s.get(payload.requestId),
      );
      if (
        old &&
        (old.ownerId !== ownerId ||
          !["pending", "conflict"].includes(old.state))
      )
        throw new Error(
          "This bill is already confirmed or voided; it cannot be overwritten.",
        );
      if (
        old?.state === "pending" &&
        JSON.stringify(old.payload) !== JSON.stringify(payload)
      )
        throw new Error(
          "A pending bill may already be on the server. Synchronize its original contents before editing.",
        );
      const bill = {
        id: payload.requestId,
        ownerId,
        payload,
        receipt,
        state: "pending",
        error: "",
        createdAt: old?.createdAt || new Date().toISOString(),
        history: [
          ...(old?.history || []),
          {
            at: new Date().toISOString(),
            action: old ? "REVIEWED_RETRY" : "CREATED",
            previousError: old?.error || "",
            previousPayload: old?.payload || null,
          },
        ],
      };
      await run("bills", "readwrite", (s) => s.put(bill));
      if (typeof window !== "undefined" && "serviceWorker" in navigator)
        void navigator.serviceWorker.ready
          .then((reg) => reg.sync?.register("cafe-counter-outbox"))
          .catch(() => {});
      return bill;
    },
    recoverOnline: async (intent, receipt) => {
      if (
        intent.endpoint !== "/api/admin/pos" ||
        !intent.ownerId ||
        !intent.payload?.requestId ||
        !intent.payload.lines?.length
      )
        throw Error("Invalid online bill recovery.");
      const old = await run("bills", "readonly", (s) =>
        s.get(intent.payload.requestId),
      );
      if (old) {
        if (
          old.ownerId !== intent.ownerId ||
          JSON.stringify(old.payload) !== JSON.stringify(intent.payload)
        )
          throw Error("A different bill already uses this ID.");
        return old;
      }
      const bill = {
        id: intent.payload.requestId,
        ownerId: intent.ownerId,
        endpoint: intent.endpoint,
        payload: intent.payload,
        receipt,
        state: "pending",
        error: "Awaiting confirmation of original online sale.",
        createdAt: intent.createdAt,
        history: [
          { at: new Date().toISOString(), action: "RECOVERED_ONLINE_REQUEST" },
        ],
      };
      await run("bills", "readwrite", (s) => s.put(bill));
      if (typeof window !== "undefined" && "serviceWorker" in navigator)
        void navigator.serviceWorker.ready
          .then((reg) => reg.sync?.register("cafe-counter-outbox"))
          .catch(() => {});
      return bill;
    },
    sync: (owner) =>
      navigator.locks
        ? navigator.locks.request(
            "cafe-counter-sync",
            { ifAvailable: true },
            (lock) => (lock ? synchronize(owner) : { pending: 1 }),
          )
        : synchronize(owner),
    retry: async (owner, id) => {
      const b = await run("bills", "readonly", (s) => s.get(id));
      if (
        !b ||
        b.ownerId !== owner ||
        !["pending", "conflict"].includes(b.state)
      )
        throw new Error("Bill cannot be retried.");
      b.state = "pending";
      b.history.push({
        at: new Date().toISOString(),
        action: "RETRY_UNCHANGED",
        previousError: b.error,
      });
      await run("bills", "readwrite", (s) => s.put(b));
    },
    void: async (owner, id, reason) => {
      const b = await run("bills", "readonly", (s) => s.get(id));
      if (
        !b ||
        b.ownerId !== owner ||
        b.state !== "conflict" ||
        String(reason).trim().length < 3
      )
        throw new Error(
          "Only a server-rejected bill can be voided with a clear reason.",
        );
      b.state = "void";
      b.error = "Voided locally: " + reason;
      b.history.push({ at: new Date().toISOString(), action: "VOID", reason });
      await run("bills", "readwrite", (s) => s.put(b));
    },
    print: (bill) => {
      const esc = (v) =>
        String(v ?? "").replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c],
        );
      if (bill.endpoint && !bill.receipt.originalQuote && !bill.order?.items)
        throw Error(
          "The original online receipt is awaiting confirmation. Synchronize this bill before printing its verified item amounts.",
        );
      const w = scope.open("", "_blank");
      if (!w) throw new Error("Allow popups to print the counter bill.");
      const r =
          bill.endpoint && bill.order?.items
            ? {
                ...bill.receipt,
                lines: bill.order.items.map((l) => ({
                  name: l.productName,
                  quantity: l.quantity,
                  total: l.lineTotal,
                  options: l.addons.map((a) => a.addonName).join(", "),
                })),
                subtotal: bill.order.subtotal,
                discount: bill.order.discount,
                tax: bill.order.tax,
                deliveryFee: bill.order.deliveryFee,
              }
            : bill.receipt,
        total = bill.payload.expectedTotal,
        cash = Number(bill.payload.cashReceived);
      w.document.write(
        `<!doctype html><html><head><title>Counter receipt</title><style>body{font:13px monospace;max-width:76mm;margin:5mm auto}h1{font-size:18px}p{white-space:pre-wrap}@page{size:80mm auto;margin:3mm}</style></head><body><h1>${esc(r.cafeName)}</h1><p>${bill.order ? esc(bill.order.orderNumber) : "PROVISIONAL — NOT SYNCHRONIZED"}</p><p>${esc(bill.id)}<br>${esc(bill.createdAt)}<br>${esc(r.serviceMode || "TAKEAWAY")} · ${esc(bill.payload.customerName)}<br>${esc(r.tableName || "")}</p>${r.lines.map((l) => `<p>${esc(l.quantity)} × ${esc(l.name)}<br>${esc(l.options || "")}<br>Rs. ${esc(l.total)}</p>`).join("")}${r.serviceMode === "DINE_IN" ? "<p>This receipt covers this table ticket only.</p>" : ""}<hr><p>Subtotal Rs. ${esc(r.subtotal)}${r.discount ? "<br>Discount Rs. " + esc(r.discount) : ""}<br>Tax Rs. ${esc(r.tax)}<br>Delivery Rs. ${esc(r.deliveryFee || 0)}<br>Total Rs. ${esc(total)}<br>Cash tendered Rs. ${esc(cash.toFixed(2))}<br>Change Rs. ${esc(Math.max(0, (Math.round(cash * 100) - total * 100) / 100).toFixed(2))}</p>${bill.payload.credit ? "<p>Credit balance due Rs. " + esc(bill.order?.remainingDue ?? Math.max(0, total - cash).toFixed(2)) + "</p>" : ""}<p>${bill.order ? esc(bill.order.paymentStatus) : bill.payload.credit ? "Credit bill awaiting server validation" : "Cash recorded locally; awaiting server validation"}</p><p>${bill.order ? "Thank you." : "Keep this bill until server confirmation. Price, stock and shift conflicts require reconciliation."}</p></body></html>`,
      );
      w.document.close();
      w.print();
    },
  };
})();

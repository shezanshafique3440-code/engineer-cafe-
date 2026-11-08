/* Durable POS queue, shared by the online app and the offline document.
 * Contains no password or session token. Server authorization is rechecked.
 */
(() => {
  const db = new Promise((resolve, reject) => {
    const request = indexedDB.open("engineer-cafe-pos", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("bills", { keyPath: "id" });
      request.result.createObjectStore("meta");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  async function run(store, mode, fn) {
    const database = await db;
    return new Promise((resolve, reject) => {
      const tx = database.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  const list = async (owner) =>
    (await run("bills", "readonly", (s) => s.getAll()))
      .filter((b) => b.ownerId === owner)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  let syncing = false;
  async function sync(owner) {
    if (syncing) return;
    syncing = true;
    try {
      const session = await fetch("/api/auth/me", { cache: "no-store" });
      const { user } = await session.json();
      if (!user || user.id !== owner)
        throw new Error(
          "Sign in as the original cashier before synchronizing.",
        );
      for (const bill of (await list(owner)).filter(
        (b) => b.state === "pending",
      )) {
        let response;
        try {
          response = await fetch("/api/admin/operations/pos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...bill.payload, action: "sale" }),
          });
        } catch {
          break;
        }
        const result = await response.json().catch(() => ({}));
        if (response.ok && (!result.order?.id || !result.order?.orderNumber)) {
          bill.error =
            "Unexpected server response. Bill retained for a safe retry.";
          await run("bills", "readwrite", (s) => s.put(bill));
          break;
        }
        if (response.ok) {
          bill.state = "synced";
          bill.order = result.order;
          bill.error = "";
        } else if (response.status >= 500) {
          break;
        } else {
          bill.state = "conflict";
          bill.error = result.error || "Sync rejected; review before retrying.";
        }
        await run("bills", "readwrite", (s) => s.put(bill));
        if (response.status === 401 || response.status === 403) break;
      }
    } finally {
      syncing = false;
    }
  }
  window.CafePOS = {
    list,
    snapshot: async (value) => {
      if (value)
        await run("meta", "readwrite", (s) => s.put(value, "snapshot"));
      return run("meta", "readonly", (s) => s.get("snapshot"));
    },
    queue: async (ownerId, payload, receipt) => {
      const existing = await run("bills", "readonly", (s) =>
        s.get(payload.clientId),
      );
      if (
        existing &&
        (existing.ownerId !== ownerId || existing.state === "synced")
      )
        throw new Error(
          "Bill is already synchronized or belongs to another cashier.",
        );
      const bill = {
        id: payload.clientId,
        ownerId,
        payload,
        receipt,
        state: "pending",
        error: "",
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      await run("bills", "readwrite", (s) => s.put(bill));
      return bill;
    },
    sync: (owner) =>
      navigator.locks
        ? navigator.locks.request("engineer-cafe-pos-sync", () => sync(owner))
        : sync(owner),
    retry: async (owner, id) => {
      const b = await run("bills", "readonly", (s) => s.get(id));
      if (!b || b.ownerId !== owner || b.state === "synced")
        throw new Error("Bill cannot be retried.");
      b.state = "pending";
      b.error = "";
      await run("bills", "readwrite", (s) => s.put(b));
    },
    discard: async (owner, id) => {
      const b = await run("bills", "readonly", (s) => s.get(id));
      if (!b || b.ownerId !== owner || b.state === "synced")
        throw new Error("Bill cannot be discarded.");
      b.state = "discarded";
      b.error = "Voided locally; never confirmed by server.";
      await run("bills", "readwrite", (s) => s.put(b));
    },
    clearSnapshot: () => run("meta", "readwrite", (s) => s.delete("snapshot")),
    print: (bill) => {
      const escape = (value) =>
        String(value ?? "").replace(
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
      const w = window.open("", "_blank");
      if (!w) throw new Error("Allow popups to print bills.");
      const r = bill.receipt;
      w.document.write(
        `<!doctype html><html><head><title>Counter bill</title><style>body{font:13px monospace;max-width:76mm;margin:6mm auto}h1{font-size:18px}p{white-space:pre-wrap}@page{size:80mm auto;margin:3mm}</style></head><body><h1>${escape(r.cafeName || "Engineer Cafe")}</h1><p>${bill.order ? escape(bill.order.orderNumber) : "PROVISIONAL — NOT SYNCHRONIZED"}</p><p>${escape(bill.id)}<br>${escape(bill.payload.orderType)} · ${escape(bill.payload.customerName)}<br>${escape(bill.payload.tableNumber || "")}</p>${r.lines.map((l) => `<p>${escape(l.quantity)} × ${escape(l.name)}<br>${escape(l.options || "")}<br>Rs. ${escape(l.total)}</p>`).join("")}<hr><p>Total Rs. ${escape(bill.payload.expectedTotal)}<br>${bill.order ? escape(bill.order.paymentStatus) : bill.payload.paid ? "Cash collected locally; awaiting server validation" : "UNPAID"}</p><p>${bill.order ? "Thank you." : "Keep this bill until the server confirms it. Prices and stock may need review."}</p></body></html>`,
      );
      w.document.close();
      w.print();
    },
  };
})();

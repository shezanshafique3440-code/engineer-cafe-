(async () => {
  const connection = document.getElementById("connection");
  const showConnection = () => {
    connection.textContent = navigator.onLine
      ? "Cash counter — every bill saves on this device first. Check each sync status below."
      : "Offline — bills are saved on this device and synchronized on reconnect.";
  };
  showConnection();
  window.addEventListener("online", showConnection);
  window.addEventListener("offline", showConnection);
  const store = globalThis.CafeOfflinePOS,
    message = document.getElementById("message"),
    editor = document.getElementById("editor"),
    form = document.getElementById("sale");
  const tell = (text) => {
    message.textContent = text;
  };
  let snapshot,
    prepared = false,
    editing = null,
    draftTouched = false;
  form.addEventListener("input", () => {
    draftTouched = true;
  });
  form.addEventListener("change", () => {
    draftTouched = true;
  });
  const make = (tag, text) => {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    return e;
  };
  try {
    snapshot = await store.snapshot();
  } catch {
    tell("Offline storage is unavailable. Keep using online POS.");
    return;
  }
  function mode() {
    const m = form.elements.serviceMode.value;
    document.getElementById("table-fields").hidden = m !== "DINE_IN";
    form.elements.sessionId.required = m === "DINE_IN";
    document.getElementById("delivery-fields").hidden = m !== "DELIVERY";
    for (const name of ["customerPhone", "addressLine", "city"])
      form.elements[name].required = m === "DELIVERY";
    total();
  }
  function tables() {
    form.elements.sessionId.replaceChildren(
      new Option("Choose open table", ""),
    );
    for (const s of snapshot?.sessions || [])
      form.elements.sessionId.append(new Option(s.table.name, s.id));
  }
  function showPrepared() {
    prepared = Boolean(snapshot?.user && snapshot.shift);
    const setup = document.getElementById("setup");
    if (setup) setup.hidden = prepared;
    const reason = document.getElementById("setup-reason");
    if (reason)
      reason.textContent = snapshot?.user
        ? "No cash shift is open under this login. Open your own cash shift, then click Refresh prepared menu & shift."
        : "Sign in to Counter POS and open your own cash shift, then return here.";
    editor.hidden = !prepared;
    document.getElementById("prepared").textContent = snapshot?.user
      ? `${snapshot.user.name} · ${snapshot.shift?.drawer.name || "No open shift"} · cached ${new Date(snapshot.savedAt).toLocaleString()}`
      : "Open the online POS and prepare this device while signed in with an open cash shift.";
  }
  function product(id) {
    return snapshot?.products.find((p) => p.id === id);
  }
  function add(line) {
    const div = make("div");
    div.className = "line";
    const pl = make("label", "Product"),
      ps = make("select");
    ps.name = "product";
    ps.required = true;
    ps.append(new Option("Choose product", ""));
    for (const p of snapshot.products)
      ps.append(
        new Option(
          `${p.name} · Rs. ${p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price}`,
          p.id,
        ),
      );
    pl.append(ps);
    div.append(pl);
    const ql = make("label", "Quantity"),
      q = make("input");
    q.name = "quantity";
    q.type = "number";
    q.min = "1";
    q.max = "50";
    q.step = "1";
    q.value = String(line?.quantity || 1);
    q.required = true;
    ql.append(q);
    div.append(ql);
    const groups = make("div");
    div.append(groups);
    function options(selected) {
      groups.replaceChildren();
      const p = product(ps.value);
      if (!p) return;
      for (const g of p.addonGroups || []) {
        const l = make("label", g.name + (g.isRequired ? " (required)" : "")),
          s = make("select");
        s.name = "addons";
        s.dataset.group = g.id;
        s.multiple = g.type === "MULTIPLE";
        if (g.type === "SINGLE" && !g.isRequired)
          s.append(new Option("None", ""));
        for (const a of g.addons.filter((a) => a.isAvailable)) {
          const o = new Option(`${a.name} (+Rs. ${a.price})`, a.id);
          o.selected = selected ? selected.includes(a.id) : a.isDefault;
          s.append(o);
        }
        l.append(s);
        groups.append(l);
      }
    }
    const nl = make("label", "Kitchen note (optional)"),
      note = make("input");
    note.name = "notes";
    note.maxLength = 200;
    note.value = line?.notes || "";
    nl.append(note);
    div.append(nl);
    const remove = make("button", "Remove item");
    remove.type = "button";
    remove.onclick = () => {
      div.remove();
      total();
    };
    div.append(remove);
    ps.onchange = () => {
      options();
      total();
    };
    div.oninput = total;
    if (line) {
      ps.value = line.productId;
      options(line.addonIds);
      if (!product(line.productId))
        div.append(
          make(
            "p",
            "This product is no longer available. Remove or replace this line.",
          ),
        );
    }
    document.getElementById("lines").append(div);
  }
  function calculate(validate = false) {
    const lines = [...document.querySelectorAll(".line")].map((d) => ({
      productId: d.querySelector("[name=product]").value,
      quantity: Number(d.querySelector("[name=quantity]").value),
      addonIds: [...d.querySelectorAll("[name=addons] option:checked")]
        .map((o) => o.value)
        .filter(Boolean),
      notes: d.querySelector("[name=notes]").value,
    }));
    const receipts = [];
    for (const line of lines) {
      const p = product(line.productId);
      if (!p) {
        if (validate) throw Error("Choose an available product on every line.");
        continue;
      }
      if (
        validate &&
        (!Number.isInteger(line.quantity) ||
          line.quantity < 1 ||
          line.quantity > 50)
      )
        throw Error("Quantity must be a whole number between 1 and 50.");
      const addons = (p.addonGroups || [])
        .flatMap((g) => g.addons)
        .filter((a) => line.addonIds.includes(a.id));
      for (const g of p.addonGroups || []) {
        const n = line.addonIds.filter((id) =>
          g.addons.some((a) => a.id === id),
        ).length;
        if (
          validate &&
          ((g.isRequired && n < Math.max(1, g.minSelect)) ||
            (g.type === "SINGLE" && n > 1) ||
            (g.maxSelect > 0 && n > g.maxSelect))
        )
          throw Error("Check " + g.name + " for " + p.name + ".");
      }
      const price =
        p.discountPrice && p.discountPrice < p.price
          ? p.discountPrice
          : p.price;
      receipts.push({
        name: p.name,
        quantity: line.quantity,
        options: addons.map((a) => a.name).join(", "),
        total:
          (price + addons.reduce((sum, a) => sum + a.price, 0)) * line.quantity,
      });
    }
    if (validate && (!lines.length || lines.length > 60))
      throw Error("Add between 1 and 60 product lines.");
    const subtotal = receipts.reduce((sum, r) => sum + r.total, 0),
      tax = Math.round((subtotal * (snapshot?.settings.taxPercent || 0)) / 100);
    const free = snapshot?.settings.freeDeliveryOver,
      deliveryFee =
        form.elements.serviceMode.value === "DELIVERY" &&
        subtotal > 0 &&
        !(free != null && free > 0 && subtotal >= free)
          ? snapshot?.settings.deliveryFee || 0
          : 0;
    return {
      lines,
      receipts,
      subtotal,
      tax,
      deliveryFee,
      total: subtotal + tax + deliveryFee,
    };
  }
  function total() {
    const c = calculate();
    document.getElementById("total").textContent =
      `Subtotal Rs. ${c.subtotal} + tax Rs. ${c.tax} + delivery Rs. ${c.deliveryFee} = provisional total Rs. ${c.total}`;
  }
  async function list() {
    const area = document.getElementById("bills");
    area.replaceChildren();
    if (!snapshot?.user) return;
    for (const b of await store.list(snapshot.user.id)) {
      const card = make("section");
      card.append(
        make(
          "strong",
          `${b.order?.orderNumber || b.id} · ${b.state} · Rs. ${b.payload.expectedTotal}`,
        ),
        make("p", b.error),
      );
      if (b.errorFields)
        card.append(make("p", Object.values(b.errorFields).flat().join(" ")));
      const print = make("button", "Print bill");
      print.onclick = () => {
        try {
          store.print(b);
        } catch (e) {
          tell(e.message);
        }
      };
      card.append(print);
      if (b.state === "conflict") {
        const retry = make("button", "Retry unchanged");
        retry.onclick = async () => {
          await store.retry(snapshot.user.id, b.id);
          await sync();
        };
        card.append(retry);
        const review = make("button", "Review & correct");
        review.onclick = async () => {
          if (!navigator.onLine) {
            tell(
              "Reconnect to load current prices and your current shift before reviewing a rejected bill.",
            );
            return;
          }
          try {
            await refresh();
            if (snapshot.user.id !== b.ownerId)
              throw Error(
                "Sign in as the original cashier before reviewing this bill.",
              );
            if (!prepared) throw Error("Open your own cash shift first.");
            editing = b;
            form.elements.customerName.value = b.payload.customerName;
            form.elements.cashReceived.value = b.payload.cashReceived;
            form.elements.serviceMode.value =
              b.payload.serviceMode || "TAKEAWAY";
            form.elements.sessionId.value = b.payload.sessionId || "";
            form.elements.customerPhone.value = b.payload.customerPhone || "";
            form.elements.addressLine.value = b.payload.addressLine || "";
            form.elements.city.value = b.payload.city || snapshot.settings.city;
            mode();
            document.getElementById("lines").replaceChildren();
            for (const l of b.payload.lines) add(l);
            document.getElementById("bill-heading").textContent =
              "Review rejected bill " + b.id;
            document.getElementById("cancel-edit").hidden = false;
            total();
            scrollTo(0, 0);
            tell(
              "Review the new total and cash difference. Saving explicitly moves this rejected bill to the currently prepared shift.",
            );
          } catch (e) {
            tell(e.message);
          }
        };
        card.append(review);
        const cancel = make("button", "Void rejected bill");
        cancel.onclick = async () => {
          const reason = prompt(
            "Why is this rejected bill being voided? Reconcile any collected cash before continuing.",
          );
          if (!reason) return;
          try {
            await store.void(snapshot.user.id, b.id, reason);
            await list();
          } catch (e) {
            tell(e.message);
          }
        };
        card.append(cancel);
      }
      area.append(card);
    }
  }
  async function sync() {
    if (!snapshot?.user) {
      tell("Sign in and prepare this device before synchronizing bills.");
      return;
    }
    tell("Synchronizing saved bills…");
    try {
      const result = await store.sync(snapshot.user.id);
      tell(
        result.pending
          ? "Some bills await server confirmation. Keep them for retry."
          : result.conflicts
            ? "Some bills need review. See the reasons below."
            : "Saved bills are synchronized.",
      );
    } catch (e) {
      if (e.authRequired || /original cashier|POS access/i.test(e.message)) {
        prepared = false;
        editor.hidden = true;
      }
      tell(e.message);
    }
    await list();
  }
  async function refresh() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    let r, data;
    try {
      r = await fetch("/api/admin/offline-pos", {
        cache: "no-store",
        signal: controller.signal,
      });
      data = await r.json();
    } catch {
      throw Error(
        "Internet is unavailable. Keep using the saved cash counter; pending bills will retry when connected.",
      );
    } finally {
      clearTimeout(timer);
    }
    if (!r.ok) {
      const error = Error(data.error || "Cannot prepare this counter.");
      error.status = r.status;
      if (r.status === 401 || r.status === 403) {
        prepared = false;
        editor.hidden = true;
      }
      throw error;
    }
    const switched = snapshot?.user && snapshot.user.id !== data.user.id;
    snapshot = data;
    await store.snapshot(data);
    tables();
    showPrepared();
    if (switched) reset();
    await list();
  }
  function reset() {
    draftTouched = false;
    editing = null;
    form.reset();
    form.elements.customerName.value = "Counter guest";
    form.elements.city.value = snapshot?.settings.city || "";
    mode();
    document.getElementById("lines").replaceChildren();
    if (snapshot?.products) add();
    document.getElementById("bill-heading").textContent =
      "New provisional bill";
    document.getElementById("cancel-edit").hidden = true;
    total();
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      if (!prepared)
        throw Error(
          "Prepare this device online with your own open cash shift first.",
        );
      const c = calculate(true),
        cash = Number(form.elements.cashReceived.value);
      if (!Number.isFinite(cash) || Math.round(cash * 100) < c.total * 100)
        throw Error("Actual cash received must cover the bill.");
      const payload = {
        requestId: editing?.id || crypto.randomUUID(),
        lines: c.lines,
        expectedTotal: c.total,
        expectedLineTotals: c.receipts.map((l) => l.total),
        customerName: form.elements.customerName.value.trim(),
        cashReceived: cash,
        accountId: snapshot.shift.drawer.accountId,
        shiftId: snapshot.shift.id,
        offline: true,
        serviceMode: form.elements.serviceMode.value,
        ...(form.elements.serviceMode.value === "DINE_IN"
          ? { sessionId: form.elements.sessionId.value }
          : {}),
        ...(form.elements.serviceMode.value === "DELIVERY"
          ? {
              customerPhone: form.elements.customerPhone.value,
              addressLine: form.elements.addressLine.value,
              city: form.elements.city.value,
            }
          : {}),
      };
      await store.queue(snapshot.user.id, payload, {
        cafeName: snapshot.settings.cafeName,
        lines: c.receipts,
        subtotal: c.subtotal,
        tax: c.tax,
        deliveryFee: c.deliveryFee,
        serviceMode: payload.serviceMode,
        tableName: (snapshot.sessions || []).find(
          (s) => s.id === payload.sessionId,
        )?.table.name,
      });
      tell(
        "Provisional bill saved on this device. Print it below and keep the cash for reconciliation.",
      );
      reset();
      await list();
      if (navigator.onLine) await sync();
    } catch (e) {
      tell(e.message);
    }
  };
  form.elements.serviceMode.onchange = mode;
  document.getElementById("add").onclick = () => {
    add();
    total();
  };
  document.getElementById("cancel-edit").onclick = reset;
  document.getElementById("sync").onclick = sync;
  document.getElementById("refresh").onclick = async () => {
    try {
      await window.CafeOfflineBootstrap?.prepareShell();
      await refresh();
      if (!draftTouched) reset();
      else total();
      tell(
        draftTouched
          ? "Menu updated. Review your current bill total before saving."
          : prepared
            ? "Counter ready. Choose products and save your cash bill below."
            : "Open your own cash shift, then refresh this counter again.",
      );
    } catch (e) {
      tell(e.message);
    }
  };
  document.getElementById("export").onclick = async () => {
    if (!snapshot?.user) {
      tell("Sign in as the original cashier to export their saved bills.");
      return;
    }
    const a = make("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(await store.list(snapshot.user.id), null, 2)], {
        type: "application/json",
      }),
    );
    a.download = "cafe-offline-bills.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  // WAN can fail/recover while Wi-Fi stays connected and navigator.onLine
  // never changes. Retry pending bills without relying on a focus/online event.
  const retryPending = async () => {
    if (document.hidden || !navigator.onLine || !snapshot?.user) return;
    if ((await store.list(snapshot.user.id)).some((b) => b.state === "pending"))
      await sync();
  };
  setInterval(() => void retryPending().catch((e) => tell(e.message)), 15000);
  window.addEventListener("online", () => void sync());
  window.addEventListener("focus", () => {
    if (navigator.onLine) void sync();
  });
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("cafe-offline-counter");
    channel.onmessage = (e) => {
      if (e.data?.type === "logout") {
        prepared = false;
        snapshot = null;
        editor.hidden = true;
        document.getElementById("bills").replaceChildren();
        tell(
          "Cashier signed out. Sign in online before preparing another bill.",
        );
      }
    };
  }
  tables();
  showPrepared();
  reset();
  await list();
  if (navigator.onLine) {
    // Keep a prepared form usable during a router/WAN outage. A real login or
    // permission rejection below still closes it; sync independently verifies
    // the original cashier before sending any locally saved bill.
    try {
      await refresh();
      if (!draftTouched) reset();
      else total();
      if (prepared) {
        await sync();
        if (draftTouched)
          tell("Menu updated. Review your current bill total before saving.");
      } else tell("Open your own cash shift, then refresh this counter again.");
    } catch (e) {
      if (e.status !== 401 && e.status !== 403) showPrepared();
      tell(e.message);
    }
  } else {
    tell(
      prepared
        ? "Counter ready offline. Save cash bills here; they will synchronize when the internet returns."
        : "Connect to the internet, sign in and open your own cash shift to prepare this device.",
    );
  }
})();

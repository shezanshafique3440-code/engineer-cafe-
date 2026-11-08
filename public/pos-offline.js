(async () => {
  const store = window.CafePOS,
    msg = document.getElementById("message"),
    editor = document.getElementById("editor");
  const tell = (text) => {
    msg.textContent = text;
  };
  let snapshot;
  try {
    snapshot = await store.snapshot();
  } catch {
    tell("This browser cannot access offline storage.");
    return;
  }
  if (!snapshot?.user) {
    tell(
      "Offline billing has not been prepared for this device. Open POS online with an active cashier shift first.",
    );
    return;
  }
  const { user, data } = snapshot;
  document.getElementById("cashier").textContent =
    `${user.name} · prepared ${new Date(snapshot.savedAt).toLocaleString()}`;
  editor.hidden = !data.shift;
  let index = 0;
  function make(tag, text) {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    return e;
  }
  function add() {
    const div = make("div");
    div.className = "line";
    div.dataset.index = String(index++);
    const label = make("label", "Product");
    const select = make("select");
    select.name = "product";
    select.required = true;
    select.append(new Option("Choose product", ""));
    data.products.forEach((p) =>
      select.append(
        new Option(
          `${p.name} · Rs. ${p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price}`,
          p.id,
        ),
      ),
    );
    label.append(select);
    div.append(label);
    const qtyLabel = make("label", "Quantity");
    const qty = make("input");
    qty.name = "quantity";
    qty.type = "number";
    qty.min = "1";
    qty.max = "50";
    qty.value = "1";
    qty.required = true;
    qtyLabel.append(qty);
    div.append(qtyLabel);
    const options = make("div");
    div.append(options);
    select.onchange = () => {
      options.replaceChildren();
      const p = data.products.find((p) => p.id === select.value);
      if (!p) return;
      p.addonGroups.forEach(({ addonGroup: g }) => {
        const l = make("label", g.name + (g.isRequired ? " (required)" : ""));
        const s = make("select");
        s.name = "addons";
        s.multiple = g.type === "MULTIPLE";
        if (!s.multiple && !g.isRequired) s.append(new Option("None", ""));
        g.addons.forEach((a) => {
          const o = new Option(`${a.name} (+Rs. ${a.price})`, a.id);
          o.selected = a.isDefault;
          s.append(o);
        });
        l.append(s);
        options.append(l);
      });
      total();
    };
    const remove = make("button", "Remove item");
    remove.type = "button";
    remove.onclick = () => {
      div.remove();
      total();
    };
    div.append(remove);
    div.oninput = total;
    document.getElementById("lines").append(div);
  }
  function details() {
    return [...document.querySelectorAll(".line")]
      .map((div) => ({
        productId: div.querySelector("[name=product]").value,
        quantity: Number(div.querySelector("[name=quantity]").value),
        addonIds: [...div.querySelectorAll("[name=addons] option:checked")]
          .map((o) => o.value)
          .filter(Boolean),
      }))
      .filter((l) => l.productId);
  }
  function receipt(lines) {
    return lines.map((l) => {
      const p = data.products.find((p) => p.id === l.productId);
      const addons = p.addonGroups
        .flatMap((x) => x.addonGroup.addons)
        .filter((a) => l.addonIds.includes(a.id));
      const price =
        p.discountPrice && p.discountPrice < p.price
          ? p.discountPrice
          : p.price;
      return {
        name: p.name,
        quantity: l.quantity,
        total: (price + addons.reduce((s, a) => s + a.price, 0)) * l.quantity,
        options: addons.map((a) => a.name).join(", "),
      };
    });
  }
  function calculate() {
    const form = document.getElementById("sale");
    const lines = details();
    const receipts = receipt(lines);
    const subtotal = receipts.reduce((s, l) => s + l.total, 0);
    const delivery =
      form.elements.orderType.value === "DELIVERY" &&
      !(
        data.settings.freeDeliveryOver &&
        subtotal >= data.settings.freeDeliveryOver
      )
        ? data.settings.deliveryFee
        : 0;
    return {
      lines,
      receipts,
      total:
        subtotal +
        Math.round((subtotal * data.settings.taxPercent) / 100) +
        delivery,
    };
  }
  function total() {
    document.getElementById("total").textContent =
      `Provisional total Rs. ${calculate().total}`;
  }
  async function bills() {
    const list = document.getElementById("bills");
    list.replaceChildren();
    for (const b of await store.list(user.id)) {
      const card = make("section");
      card.append(
        make(
          "strong",
          `${b.order?.orderNumber || b.id} · ${b.state} · Rs. ${b.payload.expectedTotal}`,
        ),
        make("p", b.error),
      );
      const print = make("button", "Print bill");
      print.onclick = () => store.print(b);
      card.append(print);
      if (b.state === "conflict") {
        const retry = make("button", "Retry unchanged bill");
        retry.onclick = async () => {
          await store.retry(user.id, b.id);
          await sync();
        };
        card.append(retry);
        card.append(
          make(
            "p",
            "Price, shift or stock conflicts must be reviewed in online POS. Keep any collected cash for reconciliation.",
          ),
        );
      }
      list.append(card);
    }
  }
  async function sync() {
    try {
      await store.sync(user.id);
      tell("Sync attempted. Check each bill status below.");
    } catch (e) {
      tell(e.message);
    }
    await bills();
  }
  document.getElementById("add").onclick = add;
  document.getElementById("sync").onclick = sync;
  document.getElementById("sale").oninput = total;
  document.getElementById("sale").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const form = e.currentTarget;
      const c = calculate();
      if (!c.lines.length) throw new Error("Add at least one product.");
      if (
        form.elements.orderType.value === "DINE_IN" &&
        !form.elements.tableNumber.value
      )
        throw new Error("Enter the table number.");
      if (
        form.elements.orderType.value === "DELIVERY" &&
        (!form.elements.customerPhone.value || !form.elements.addressLine.value)
      )
        throw new Error("Delivery needs phone and address.");
      const payload = {
        clientId: crypto.randomUUID(),
        lines: c.lines,
        orderType: form.elements.orderType.value,
        tableNumber: form.elements.tableNumber.value,
        customerName: form.elements.customerName.value,
        customerPhone: form.elements.customerPhone.value,
        addressLine: form.elements.addressLine.value,
        shiftId: data.shift.id,
        discount: 0,
        expectedTotal: c.total,
        paid: form.elements.paid.checked,
        paymentMethod:
          form.elements.paid.checked ||
          form.elements.orderType.value !== "DELIVERY"
            ? "CASH_AT_COUNTER"
            : "CASH_ON_DELIVERY",
      };
      const bill = await store.queue(user.id, payload, {
        cafeName: data.settings.cafeName,
        lines: c.receipts,
      });
      tell(`Saved provisional bill ${bill.id}. Use Print bill below.`);
      document.getElementById("lines").replaceChildren();
      add();
      total();
      await bills();
      if (navigator.onLine) await sync();
    } catch (e) {
      tell(e.message);
    }
  };
  window.addEventListener("online", sync);
  add();
  total();
  await bills();
  tell(
    "Offline mode ready. Bills are stored on this device for the prepared cashier. Synchronization requires that cashier to sign in again if the session expires.",
  );
  if (navigator.onLine) await sync();
})();

import QRCode from "qrcode";
import type { OrderDTO } from "@/server/orders";
import type { PublicSettings } from "@/server/settings";
import { ORDER_TYPE_LABEL, PAYMENT_METHOD_LABEL, ORDER_STATUS_LABEL } from "./constants";
import { formatDate } from "./utils";

/**
 * The printed order slip.
 *
 * Sized for an 80mm thermal roll, which is what a cafe counter actually has,
 * but it also prints cleanly to A4 or "Save as PDF". Deliberately monochrome:
 * thermal heads are single-colour, and on an inkjet a coloured slip just costs
 * the cafe money. Weight, rules and spacing carry the hierarchy instead.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ReceiptOptions = {
  settings: PublicSettings;
  money: (amount: number) => string;
  /** Absolute origin, used for the tracking link behind the QR code. */
  origin: string;
};

/**
 * A QR code the customer can scan off the slip to follow their order. Returns
 * null if generation fails so a printer jam is never caused by a missing
 * graphic — the slip simply prints without it.
 */
async function trackingQr(order: OrderDTO, origin: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(`${origin}/orders/${order.id}`, {
      margin: 0,
      width: 220,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

/**
 * The slip is written into a blank popup, which has no base URL of its own, so
 * a stored path like "/brand/logo.svg" would resolve to nothing. Absolute URLs
 * (Cloudinary, S3) are passed through untouched.
 */
function absoluteLogo(logoUrl: string | null, origin: string): string | null {
  if (!logoUrl) return null;
  if (/^(https?:|data:)/i.test(logoUrl)) return logoUrl;
  return `${origin}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;
}

export async function buildReceiptHtml(
  order: OrderDTO,
  { settings, money, origin }: ReceiptOptions,
): Promise<string> {
  const qr = await trackingQr(order, origin);
  const logo = absoluteLogo(settings.logoUrl, origin);
  const isPaid = order.paymentStatus === "PAID";

  const items = order.items
    .map((item) => {
      const addons = item.addons.length
        ? `<div class="sub">${escapeHtml(
            item.addons.map((a) => a.addonName).join(" · "),
          )}</div>`
        : "";
      const note = item.notes
        ? `<div class="sub note">“${escapeHtml(item.notes)}”</div>`
        : "";
      return `<tr>
        <td class="qty">${item.quantity}<span>×</span></td>
        <td class="name">
          <div class="item">${escapeHtml(item.productName)}</div>
          ${addons}${note}
        </td>
        <td class="amt">${escapeHtml(money(item.lineTotal))}</td>
      </tr>`;
    })
    .join("");

  const line = (label: string, value: string, cls = "") =>
    `<div class="row ${cls}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;

  const address = [order.addressLine, order.area, order.city]
    .filter(Boolean)
    .join(", ");

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Order ${escapeHtml(order.orderNumber)} — ${escapeHtml(settings.cafeName)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }

  :root { --ink: #000; --muted: #444; --rule: #000; }

  * { box-sizing: border-box; }

  body {
    margin: 0 auto;
    padding: 10mm 6mm 8mm;
    width: 80mm;
    background: #fff;
    color: var(--ink);
    font-family: ui-sans-serif, "Helvetica Neue", Arial, sans-serif;
    font-size: 11.5px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }

  /* --- masthead --- */
  .brand { text-align: center; }
  .brand img { max-width: 34mm; max-height: 16mm; object-fit: contain; }
  .brand h1 {
    margin: 4px 0 1px;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  /* No uppercase or letter-spacing here: the tagline is often Urdu, and both
     mangle it. */
  .brand .tag { font-size: 10.5px; color: var(--muted); }
  .brand address {
    margin-top: 5px;
    font-style: normal;
    font-size: 10px;
    color: var(--muted);
  }

  /* --- rules --- */
  hr { border: none; border-top: 1px solid var(--rule); margin: 9px 0; }
  hr.dash { border-top: 1px dashed #999; }

  /* --- the order number, the thing staff read across a counter --- */
  .ref { text-align: center; margin: 2px 0 6px; }
  .ref .num {
    font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-size: 25px;
    font-weight: 700;
    letter-spacing: .03em;
    line-height: 1.1;
  }
  .ref .meta { font-size: 10px; color: var(--muted); margin-top: 2px; }

  .badges { display: flex; justify-content: center; gap: 4px; margin-top: 5px; }
  .badge {
    border: 1px solid var(--ink);
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .badge.solid { background: var(--ink); color: #fff; }

  /* --- customer --- */
  .who { font-size: 11.5px; }
  .who .name { font-weight: 700; }
  .who .line { color: var(--muted); font-size: 10.5px; }
  .instr {
    margin-top: 5px;
    padding: 4px 6px;
    border-left: 2px solid var(--ink);
    font-size: 10.5px;
  }

  /* --- items --- */
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 0; vertical-align: top; }
  .qty {
    width: 22px;
    font-family: ui-monospace, monospace;
    font-weight: 700;
    white-space: nowrap;
  }
  .qty span { font-weight: 400; color: var(--muted); margin-left: 1px; }
  .name { padding-right: 6px; }
  .item { font-weight: 600; }
  .sub { font-size: 10px; color: var(--muted); }
  .note { font-style: italic; }
  .amt {
    text-align: right;
    white-space: nowrap;
    font-family: ui-monospace, monospace;
  }

  /* --- totals --- */
  .row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 2px 0;
    font-size: 11px;
  }
  .row span:last-child { font-family: ui-monospace, monospace; }
  .row.muted span { color: var(--muted); }
  .row.total {
    font-size: 15px;
    font-weight: 800;
    padding: 6px 0 2px;
    border-top: 2px solid var(--ink);
    margin-top: 4px;
  }

  .pay { display: flex; justify-content: space-between; font-size: 11px; }
  .pay .status { font-weight: 700; letter-spacing: .06em; }

  /* --- footer --- */
  .qr { text-align: center; margin-top: 10px; }
  .qr img { width: 26mm; height: 26mm; }
  .qr p { margin: 4px 0 0; font-size: 9.5px; color: var(--muted); }
  .thanks { text-align: center; margin-top: 10px; font-size: 11px; font-weight: 600; }
  .fine { text-align: center; margin-top: 3px; font-size: 9.5px; color: var(--muted); }

  @media print {
    body { padding: 4mm 3mm 6mm; }
    .qr img { width: 24mm; height: 24mm; }
  }
</style></head>
<body>

  <div class="brand">
    ${logo ? `<img src="${escapeHtml(logo)}" alt="">` : ""}
    <h1>${escapeHtml(settings.cafeName)}</h1>
    <div class="tag">${escapeHtml(settings.tagline)}</div>
    <address>
      ${escapeHtml(settings.address)}<br>
      ${escapeHtml(settings.phone)}
    </address>
  </div>

  <hr>

  <div class="ref">
    <div class="num">#${escapeHtml(order.orderNumber)}</div>
    <div class="meta">${escapeHtml(formatDate(order.placedAt, true))}</div>
    <div class="badges">
      <span class="badge solid">${escapeHtml(ORDER_TYPE_LABEL[order.orderType])}</span>
      <span class="badge">${escapeHtml(ORDER_STATUS_LABEL[order.status])}</span>
    </div>
  </div>

  <hr class="dash">

  <div class="who">
    <div class="name">${escapeHtml(order.customerName)}</div>
    <div class="line">${escapeHtml(order.customerPhone)}</div>
    ${address ? `<div class="line">${escapeHtml(address)}</div>` : ""}
  </div>
  ${order.instructions ? `<div class="instr">${escapeHtml(order.instructions)}</div>` : ""}

  <hr class="dash">

  <table>${items}</table>

  <hr class="dash">

  ${line(`Subtotal (${itemCount} item${itemCount === 1 ? "" : "s"})`, money(order.subtotal))}
  ${order.discount ? line(`Discount${order.couponCode ? ` · ${order.couponCode}` : ""}`, `− ${money(order.discount)}`, "muted") : ""}
  ${order.deliveryFee ? line("Delivery", money(order.deliveryFee), "muted") : ""}
  ${order.tax ? line("Tax", money(order.tax), "muted") : ""}
  <div class="row total"><span>TOTAL</span><span>${escapeHtml(money(order.total))}</span></div>

  <hr class="dash">

  <div class="pay">
    <span>${escapeHtml(PAYMENT_METHOD_LABEL[order.paymentMethod])}</span>
    <span class="status">${isPaid ? "PAID" : "DUE"}</span>
  </div>

  ${
    qr
      ? `<div class="qr">
           <img src="${qr}" alt="">
           <p>Scan to track your order</p>
         </div>`
      : ""
  }

  <div class="thanks">Shukriya! Phir milte hain.</div>
  <div class="fine">
    WhatsApp +${escapeHtml(settings.whatsapp)}<br>
    ${escapeHtml(settings.openingHours)}
  </div>

</body></html>`;
}

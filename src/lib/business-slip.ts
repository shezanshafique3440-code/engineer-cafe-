import { printSlip } from "./receipt";
const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export function businessSlipHtml(
  title: string,
  entries: [string, string][],
  footer: string,
) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:14px system-ui;color:#111;max-width:700px;margin:24px auto;padding:16px}h1{font-size:24px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ccc;text-align:left;overflow-wrap:anywhere}th{width:45%}footer{margin-top:24px;white-space:pre-wrap}button{margin-bottom:20px;padding:10px 18px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>${escape(title)}</h1><table>${entries.map(([k, v]) => `<tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`).join("")}</table><footer>${escape(footer)}</footer></body></html>`;
}
export async function printBusinessSlip(
  title: string,
  entries: [string, string][],
  footer: string,
) {
  const win = window.open("", "_blank", "width=800,height=750");
  if (!win) throw Error("Allow popups to print this statement.");
  await printSlip(win, businessSlipHtml(title, entries, footer));
}

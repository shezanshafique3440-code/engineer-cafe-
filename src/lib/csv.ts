/** Quote every CSV cell, including neutralizing spreadsheet formulas. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function makeCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const url = URL.createObjectURL(new Blob([makeCsv(headers, rows)], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

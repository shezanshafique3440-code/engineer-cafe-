export function menuQrUrl(origin: string, destination: string, campaign = "") {
  const base = new URL(origin);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw new Error("Invalid website origin.");
  if (!/^\/(?:menu(?:\/[a-z0-9-]+){0,2}|meal-finder)$/.test(destination))
    throw new Error("Choose a menu destination.");
  const url = new URL(destination, base.origin);
  if (campaign.trim()) {
    url.searchParams.set("utm_source", "qr");
    url.searchParams.set("utm_medium", "print");
    url.searchParams.set("utm_campaign", campaign.trim().slice(0, 80));
  }
  return url.toString();
}
export function escapeMarkup(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

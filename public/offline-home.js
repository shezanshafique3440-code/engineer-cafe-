/* Reopening the installed app without internet returns a prepared cashier to
 * their cash counter. An unprepared/customer browser keeps the public fallback. */
(async () => {
  try {
    const prepared = await globalThis.CafeOfflinePOS?.snapshot();
    if (prepared?.user && prepared.shift) location.replace("/offline-pos.html");
  } catch {
    /* The public fallback and explicit counter link remain available. */
  }
})();

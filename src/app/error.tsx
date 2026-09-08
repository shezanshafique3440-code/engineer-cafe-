"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for observability — never surface the stack trace to the customer.
    console.error("[app]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream-50 px-4 text-center">
      <p className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-chilli-500">
        Unhandled exception
      </p>
      <h1 className="mt-4 text-3xl font-extrabold md:text-5xl">Something went wrong.</h1>
      <p className="mx-auto mt-4 max-w-md text-sm text-charcoal-600 md:text-base">
        We hit an error on our side. Try again — and if it keeps happening, message us on WhatsApp
        and we&apos;ll take your order directly.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary px-6 py-3">
          Try again
        </button>
        <Link href="/" className="btn-secondary px-6 py-3">Back home</Link>
      </div>
      {error.digest && (
        <p className="mt-8 font-mono text-xs text-charcoal-300">Reference: {error.digest}</p>
      )}
    </div>
  );
}

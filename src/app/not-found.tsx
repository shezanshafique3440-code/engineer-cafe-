import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream-50 px-4 text-center">
      <div className="blueprint pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="relative">
        <p className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-chai-600">
          Error 404
        </p>
        <h1 className="mt-4 text-4xl font-extrabold md:text-6xl">Chai Not Found.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-charcoal-600 md:text-base">
          This page doesn&apos;t exist — but the kettle&apos;s still on. Let&apos;s get you back to
          something you can actually order.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary px-6 py-3">Back home</Link>
          <Link href="/menu" className="btn-secondary px-6 py-3">Browse the menu</Link>
        </div>
        <p className="mt-10 font-mono text-xs text-charcoal-300">
          {"// try: SELECT * FROM chai WHERE mood = 'karak'"}
        </p>
      </div>
    </div>
  );
}

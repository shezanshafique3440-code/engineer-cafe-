import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/account/auth-forms";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="flex relative min-h-dvh items-center justify-center overflow-hidden bg-charcoal-900 px-4 py-8 sm:py-14">
      <div className="blueprint pointer-events-none absolute inset-0 opacity-10" aria-hidden />
      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-charcoal-700 bg-charcoal-800 p-5 shadow-2xl sm:p-8">
          <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-chai-600 text-cream-50">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-cream-50">Cafe control room</h1>
          <p className="mt-1.5 text-sm text-charcoal-300">
            Sign in with your staff account to manage orders, menu and your cafe.
          </p>

          <div className="mt-6 [&_.label]:text-charcoal-300 [&_input]:border-charcoal-700 [&_input]:bg-charcoal-900 [&_input]:text-cream-50 [&_input]:placeholder:text-charcoal-500">
            <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-charcoal-700" />}>
              <LoginForm adminMode />
            </Suspense>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-cream-200">
          <Link href="/" className="inline-flex min-h-11 items-center hover:text-chai-400">← Back to cafe</Link>
          <Link href="/login" className="inline-flex min-h-11 items-center hover:text-chai-400">Customer login</Link>
        </div>
        <p className="mt-2 text-center text-xs text-charcoal-300">Authorized staff only · Secure sign in</p>
      </div>
    </div>
  );
}

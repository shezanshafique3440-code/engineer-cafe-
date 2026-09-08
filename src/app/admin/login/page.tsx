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
    <div className="flex min-h-screen items-center justify-center bg-charcoal-900 p-4">
      <div className="blueprint pointer-events-none absolute inset-0 opacity-10" aria-hidden />
      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-charcoal-700 bg-charcoal-800 p-7">
          <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-chai-600 text-cream-50">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-cream-50">Engineer Cafe Admin</h1>
          <p className="mt-1.5 text-sm text-charcoal-300">
            Staff access only. Customers should use the main login.
          </p>

          <div className="mt-6 [&_.label]:text-charcoal-300 [&_input]:border-charcoal-700 [&_input]:bg-charcoal-900 [&_input]:text-cream-50 [&_input]:placeholder:text-charcoal-500">
            <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-charcoal-700" />}>
              <LoginForm adminMode />
            </Suspense>
          </div>
        </div>

        <p className="mt-5 text-center font-mono text-xs text-charcoal-500">
          {"// sudo access required"}
        </p>
      </div>
    </div>
  );
}

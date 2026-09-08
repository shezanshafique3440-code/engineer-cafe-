import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { LoginForm } from "@/components/account/auth-forms";

export const metadata: Metadata = buildMetadata({
  title: "Login",
  description: "Sign in to your Engineer Cafe account to track orders and reorder favorites.",
  path: "/login",
});

export default function LoginPage() {
  return (
    <div className="container flex items-center justify-center py-12 md:py-20">
      <div className="w-full max-w-md">
        <div className="surface p-6 md:p-8">
          <p className="eyebrow">{"// welcome back"}</p>
          <h1 className="mt-2 text-2xl font-extrabold">Login to Engineer Cafe</h1>
          <p className="mt-1.5 text-sm text-charcoal-500">
            Track your orders, save favorites and reorder in one tap.
          </p>

          <div className="mt-6">
            <Suspense fallback={<div className="skeleton h-64 w-full" />}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-5 text-center text-sm text-charcoal-500">
            New here?{" "}
            <Link href="/register" className="font-semibold text-chai-700 hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center font-mono text-xs text-charcoal-300">
          {"// sudo make me a chai"}
        </p>
      </div>
    </div>
  );
}

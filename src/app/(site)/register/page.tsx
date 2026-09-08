import { Suspense } from "react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { RegisterForm } from "@/components/account/auth-forms";

export const metadata: Metadata = buildMetadata({
  title: "Create an account",
  description: "Join Engineer Cafe to track orders, save favorites and unlock student deals.",
  path: "/register",
});

export default function RegisterPage() {
  return (
    <div className="container flex items-center justify-center py-12 md:py-20">
      <div className="w-full max-w-md">
        <div className="surface p-6 md:p-8">
          <p className="eyebrow">{"// git init your account"}</p>
          <h1 className="mt-2 text-2xl font-extrabold">Create your account</h1>
          <p className="mt-1.5 text-sm text-charcoal-500">
            Faster checkout, order history and one-tap reordering.
          </p>

          <div className="mt-6">
            <Suspense fallback={<div className="skeleton h-80 w-full" />}>
              <RegisterForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

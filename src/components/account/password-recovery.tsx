"use client";
import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api-client";
import { Button, Input, PasswordInput } from "@/components/ui";
export function PasswordRecovery({ token }: { token?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  return (
    <div className="surface mx-auto max-w-md space-y-5 p-6 md:p-8">
      <h1 className="text-2xl font-bold">
        {token ? "Choose a new password" : "Forgot your password?"}
      </h1>
      <p className="text-sm text-charcoal-600">
        {token
          ? "Use a strong password between 8 and 72 characters. Changing your password signs out previous sessions."
          : "Enter your account email to request a private reset link. If email recovery is unavailable, contact the cafe owner."}
      </p>
      {message && (
        <p
          role="status"
          className="rounded-xl border border-cream-300 p-3 text-sm"
        >
          {message}
        </p>
      )}
      {!done && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const result = await apiPost<{ message: string }>(
                token
                  ? "/api/auth/reset-password"
                  : "/api/auth/forgot-password",
                token ? { token, password } : { email },
              );
              setMessage(result.message);
              setDone(true);
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {token ? (
            <PasswordInput
              label="New password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          ) : (
            <Input
              label="Account email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          <Button loading={busy} type="submit" className="w-full">
            {token ? "Save new password" : "Request reset link"}
          </Button>
        </form>
      )}
      <Link
        href="/login"
        className="block text-center text-sm font-semibold text-chai-700"
      >
        Back to sign in
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api-client";
import { useSession } from "@/context/session-context";
import { Button, Input, PasswordInput } from "@/components/ui";
import { safeRedirect } from "@/lib/safe-redirect";
import type { SessionUser } from "@/lib/types";

export function LoginForm({ adminMode = false }: { adminMode?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useSession();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setMessage("");
    setSubmitting(true);
    try {
      const data = await apiPost<{ user: SessionUser }>("/api/auth/login", form);
      setUser(data.user);


      const next = searchParams.get("next");
      const isStaff = data.user.role === "ADMIN" || data.user.role === "STAFF";

      if (adminMode && !isStaff) {
        setMessage("This account does not have admin access. Use your staff email and password.");
        setSubmitting(false);
        return;
      }

      toast.success(`Welcome back, ${data.user.name.split(" ")[0]}!`);
      router.push(safeRedirect(next, isStaff && adminMode ? "/admin" : "/account"));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        setMessage(error.message);
        toast.error(error.message);
      } else {
        setMessage("Couldn't sign you in. Check your connection and try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-busy={submitting}>
      {message && <p role="alert" className="rounded-xl border border-chilli-400/40 bg-chilli-400/10 p-3 text-sm text-chilli-600">{message}</p>}
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        error={errors.email?.[0]}
        required
      />
      <PasswordInput
        label="Password"
        name="password"
        autoComplete="current-password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        error={errors.password?.[0]}
        required
      />
      <Button type="submit" className="w-full" size="lg" loading={submitting}>
        {adminMode ? "Sign in to admin" : "Login"}
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useSession();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setMessage("");
    setSubmitting(true);
    try {
      const data = await apiPost<{ user: SessionUser }>("/api/auth/register", form);
      setUser(data.user);
      toast.success("Account created. Welcome to Engineer Cafe!");
      router.push(safeRedirect(searchParams.get("next"), "/account"));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        setMessage(error.message);
        toast.error(error.message);
      } else {
        setMessage("Couldn't create your account. Check your connection and try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-busy={submitting}>
      {message && <p role="alert" className="rounded-xl border border-chilli-400/40 bg-chilli-400/10 p-3 text-sm text-chilli-600">{message}</p>}
      <Input
        label="Full name"
        name="name"
        autoComplete="name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        error={errors.name?.[0]}
        required
      />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        error={errors.email?.[0]}
        required
      />
      <Input
        label="Phone (optional)"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="03001234567"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        error={errors.phone?.[0]}
      />
      <PasswordInput
        label="Password"
        name="password"
        autoComplete="new-password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        error={errors.password?.[0]}
        hint="At least 8 characters."
        required
      />
      <Button type="submit" className="w-full" size="lg" loading={submitting}>
        Create account
      </Button>
      <p className="text-center text-xs text-charcoal-400">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-chai-700 hover:underline">Login</Link>
      </p>
    </form>
  );
}

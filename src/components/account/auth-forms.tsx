"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api-client";
import { useSession } from "@/context/session-context";
import { Button, Input } from "@/components/ui";
import type { SessionUser } from "@/lib/types";

export function LoginForm({ adminMode = false }: { adminMode?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useSession();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const data = await apiPost<{ user: SessionUser }>("/api/auth/login", form);
      setUser(data.user);
      toast.success(`Welcome back, ${data.user.name.split(" ")[0]}!`);

      const next = searchParams.get("next");
      const isStaff = data.user.role === "ADMIN" || data.user.role === "STAFF";

      if (adminMode && !isStaff) {
        toast.error("This account doesn't have admin access.");
        setSubmitting(false);
        return;
      }

      router.push(next || (isStaff && adminMode ? "/admin" : "/account"));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error("Couldn't sign you in. Please try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        error={errors.email?.[0]}
        required
      />
      <Input
        label="Password"
        name="password"
        type="password"
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const data = await apiPost<{ user: SessionUser }>("/api/auth/register", form);
      setUser(data.user);
      toast.success("Account created. Welcome to Engineer Cafe!");
      router.push(searchParams.get("next") || "/account");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error("Couldn't create your account. Please try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
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
      <Input
        label="Password"
        name="password"
        type="password"
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

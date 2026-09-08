"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api-client";
import { Button, Input, Textarea } from "@/components/ui";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const data = await apiPost<{ message: string }>("/api/contact", form);
      toast.success(data.message);
      setSent(true);
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error("Couldn't send your message. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="surface flex flex-col items-center p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-circuit-500" aria-hidden />
        <h2 className="mt-4 text-lg font-bold">Message sent.</h2>
        <p className="mt-1.5 text-sm text-charcoal-500">
          We usually reply within a few hours during opening times.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => setSent(false)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 p-5 md:p-6" noValidate>
      <h2 className="text-lg font-bold">Send us a message</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          name="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name?.[0]}
          autoComplete="name"
          required
        />
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors.email?.[0]}
          autoComplete="email"
          required
        />
        <Input
          label="Phone (optional)"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="03001234567"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          error={errors.phone?.[0]}
          autoComplete="tel"
        />
        <Input
          label="Subject (optional)"
          name="subject"
          value={form.subject}
          onChange={(e) => set("subject", e.target.value)}
          error={errors.subject?.[0]}
          placeholder="Catering, feedback, group booking…"
        />
      </div>

      <Textarea
        label="Message"
        name="message"
        rows={5}
        value={form.message}
        onChange={(e) => set("message", e.target.value)}
        error={errors.message?.[0]}
        placeholder="Tell us what you need."
        required
      />

      <Button type="submit" size="lg" className="w-full" loading={submitting}>
        Send message
      </Button>
    </form>
  );
}

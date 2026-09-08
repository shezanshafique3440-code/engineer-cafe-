"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Archive, Trash2, Phone } from "lucide-react";
import { apiGet, apiPatch, apiDelete } from "@/lib/api-client";
import { PageHeader, TableSkeleton } from "./ui";
import { Button, ErrorState, Badge, EmptyState } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

type Message = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: "NEW" | "READ" | "ARCHIVED";
  createdAt: string;
};

const FILTERS = ["NEW", "READ", "ARCHIVED", "ALL"] as const;

export function MessagesManager() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("NEW");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiGet<{ messages: Message[] }>("/api/admin/messages");
      setMessages(data.messages);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (message: Message, status: Message["status"]) => {
    setUpdating(message.id);
    try {
      await apiPatch(`/api/admin/messages/${message.id}`, { status });
      setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, status } : m)));
      toast.success(status === "ARCHIVED" ? "Message archived" : "Marked as read");
    } catch {
      toast.error("Couldn't update this message.");
    } finally {
      setUpdating(null);
    }
  };

  const remove = async (message: Message) => {
    if (!window.confirm("Delete this message permanently?")) return;
    setUpdating(message.id);
    try {
      await apiDelete(`/api/admin/messages/${message.id}`);
      setMessages((current) => current.filter((m) => m.id !== message.id));
      toast.success("Message deleted");
    } catch {
      toast.error("Couldn't delete this message.");
    } finally {
      setUpdating(null);
    }
  };

  const visible = messages.filter((m) => filter === "ALL" || m.status === filter);

  return (
    <div>
      <PageHeader title="Messages" description="Enquiries from the website contact form." />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
              filter === option
                ? "border-chai-500 bg-chai-50 text-chai-700"
                : "border-cream-300 bg-white text-charcoal-600 hover:border-chai-300",
            )}
          >
            {option === "ALL" ? "All" : option.charAt(0) + option.slice(1).toLowerCase()}
            {option !== "ALL" && (
              <span className="ml-1.5 text-charcoal-400">
                {messages.filter((m) => m.status === option).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState title="Unable to load messages." onRetry={load} />
      ) : loading && messages.length === 0 ? (
        <TableSkeleton rows={3} cols={3} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Mail className="h-6 w-6" />} title="Inbox zero." description="No messages match this filter." />
      ) : (
        <ul className="space-y-3">
          {visible.map((message) => (
            <li key={message.id} className={cn("surface p-5", message.status === "NEW" && "border-chai-300")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-charcoal-900">{message.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-charcoal-500">
                    <a href={`mailto:${message.email}`} className="hover:text-chai-700 hover:underline">
                      {message.email}
                    </a>
                    {message.phone && (
                      <a href={`tel:${message.phone}`} className="inline-flex items-center gap-1 hover:text-chai-700">
                        <Phone className="h-3 w-3" aria-hidden /> {message.phone}
                      </a>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {message.status === "NEW" && <Badge tone="chai">New</Badge>}
                  {message.status === "ARCHIVED" && <Badge>Archived</Badge>}
                  <span className="text-xs text-charcoal-400">{formatDate(message.createdAt, true)}</span>
                </div>
              </div>

              {message.subject && (
                <p className="mt-3 text-sm font-semibold text-charcoal-800">{message.subject}</p>
              )}
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-charcoal-600">
                {message.message}
              </p>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-cream-200 pt-4">
                <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject ?? "Your message to Engineer Cafe"}`)}`} className="btn-primary px-3.5 py-2 text-xs">
                  <Mail className="h-3.5 w-3.5" aria-hidden /> Reply
                </a>
                {message.status === "NEW" && (
                  <Button size="sm" variant="secondary" loading={updating === message.id} onClick={() => void setStatus(message, "READ")}>
                    Mark as read
                  </Button>
                )}
                {message.status !== "ARCHIVED" && (
                  <Button size="sm" variant="secondary" loading={updating === message.id} onClick={() => void setStatus(message, "ARCHIVED")}>
                    <Archive className="h-3.5 w-3.5" aria-hidden /> Archive
                  </Button>
                )}
                <Button size="sm" variant="danger" loading={updating === message.id} onClick={() => void remove(message)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

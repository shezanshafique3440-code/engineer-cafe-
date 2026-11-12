"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { useSession } from "@/context/session-context";
import {
  adminNavigation,
  adminToolMatches,
  TOOL_GROUPS,
} from "@/lib/admin-navigation";
import { navigationIcon } from "./navigation-icons";

export function ToolsDirectory() {
  const { user } = useSession();
  const [query, setQuery] = useState("");
  const { primary, tools } = adminNavigation(user);
  const all = [...primary, ...tools];
  const found = all.filter((tool) => adminToolMatches(tool, query));
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Everything in one place</p>
          <h1 className="mt-2 text-3xl font-extrabold">
            All tools & administration
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-charcoal-600">
            Your existing reports, stock, employee and website tools are here.
            Only tools allowed for your login are shown.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/guide" className="btn-secondary">
            Quick start guide
          </Link>
          <Link href="/admin" className="btn-secondary">
            Back to daily counter
          </Link>
        </div>
      </header>
      <div className="surface relative flex items-center gap-3 p-3">
        <Search className="h-5 w-5 shrink-0 text-charcoal-500" aria-hidden />
        <input
          className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
          type="search"
          aria-label="Search all tools"
          placeholder="Find reports, products, employees, settings…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-xl hover:bg-cream-100"
            aria-label="Clear tool search"
            onClick={() => setQuery("")}
          >
            <X className="mx-auto h-4 w-4" />
          </button>
        )}
      </div>
      {TOOL_GROUPS.map((group) => {
        const items = found.filter((tool) => tool.group === group.id);
        return items.length ? (
          <section key={group.id} aria-label={group.label}>
            <h2 className="mb-3 text-lg font-bold">{group.label}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((tool) => {
                const Icon = navigationIcon(tool.icon);
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="surface flex min-h-24 items-start gap-3 p-4 transition hover:border-chai-400 hover:shadow-md"
                  >
                    <span className="rounded-xl bg-chai-50 p-3 text-chai-700">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block">{tool.label}</strong>
                      <span className="mt-1 block text-sm text-charcoal-500">
                        {tool.hint}
                      </span>
                    </span>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null;
      })}
      {!found.length && (
        <div className="surface p-6" role="status">
          <p className="font-bold">
            {all.length
              ? "No matching tools"
              : "No tools are assigned to this login"}
          </p>
          <p className="mt-2 text-sm text-charcoal-600">
            {all.length
              ? "Try a shorter name, such as Stock or Reports."
              : "Ask an owner to review your access."}
          </p>
          {query && (
            <button
              type="button"
              className="btn-secondary mt-4"
              onClick={() => setQuery("")}
            >
              Show all tools
            </button>
          )}
        </div>
      )}
    </div>
  );
}

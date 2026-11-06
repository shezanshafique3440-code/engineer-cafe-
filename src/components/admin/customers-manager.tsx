"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, ShieldCheck, ShieldOff, Trash2, RefreshCw } from "lucide-react";
import { apiDelete, apiGet, apiPatch, ApiError } from "@/lib/api-client";
import { useMoney } from "@/context/settings-context";
import { useSession } from "@/context/session-context";
import { PageHeader, DataTable, TableSkeleton, Modal } from "./ui";
import { Button, Select, ErrorState, Badge } from "@/components/ui";
import { formatDate, initials } from "@/lib/utils";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  orderCount: number;
  totalSpent: number;
  version: string;
};

export function CustomersManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState({ search: "", role: "ALL" });
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const { user, refresh: refreshSession } = useSession();
  const canManage = user?.role === "ADMIN";
  const money = useMoney();

  const load = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({ page: String(targetPage), perPage: "20", role: filters.role });
        if (filters.search.trim()) params.set("search", filters.search.trim());
        const data = await apiGet<{
          customers: Customer[]; total: number; totalPages: number;
        }>(`/api/admin/customers?${params}`);
        setCustomers(data.customers);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(targetPage);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(1), 260);
    return () => clearTimeout(timer);
  }, [load]);

  const update = async (customer: Customer, patch: { isActive?: boolean; role?: Customer["role"] }) => {
    setUpdating(customer.id);
    try {
      const data = await apiPatch<{ user: Pick<Customer, "id" | "name" | "email" | "role" | "isActive" | "version"> }>(`/api/admin/customers/${customer.id}`, patch);
      setCustomers((current) =>
        current.map((c) => (c.id === customer.id ? { ...c, ...data.user } : c)),
      );
      toast.success("Customer updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this customer.");
    } finally {
      setUpdating(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || deletingBusy) return;
    const customer = deleting;
    setDeletingBusy(true);
    try {
      await apiDelete(`/api/admin/customers/${customer.id}`, { email: customer.email, version: customer.version });
      setCustomers((current) => current.filter((row) => row.id !== customer.id));
      setTotal((current) => Math.max(0, current - 1));
      setDeleting(null);
      toast.success("Customer deleted. Previous orders were kept.");
      await load(customers.length === 1 && page > 1 ? page - 1 : page);
      requestAnimationFrame(() => refreshButton.current?.focus());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete this customer.");
      if (err instanceof ApiError && [403, 404, 409].includes(err.status)) {
        setDeleting(null);
        if (err.status === 403) await refreshSession();
        await load(page);
      }
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Customers" description={`${total} account${total === 1 ? "" : "s"}.`} action={
        <Button ref={refreshButton} variant="secondary" disabled={loading} onClick={() => void load(page)}><RefreshCw className="h-4 w-4" aria-hidden /> Refresh</Button>
      } />

      <div className="surface mb-5 grid gap-3 p-4 sm:grid-cols-2">
        <div className="relative">
          <label htmlFor="customer-search" className="label">Search</label>
          <Search className="pointer-events-none absolute left-3.5 top-[34px] h-4 w-4 text-charcoal-300" aria-hidden />
          <input
            id="customer-search"
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value }))}
            placeholder="Name, email or phone"
            className="field pl-10"
          />
        </div>
        <Select label="Role" value={filters.role} onChange={(e) => setFilters((c) => ({ ...c, role: e.target.value }))}>
          <option value="ALL">All roles</option>
          <option value="CUSTOMER">Customers</option>
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admins</option>
        </Select>
      </div>

      {error ? (
        <ErrorState title="Unable to load customers." onRetry={() => void load(page)} />
      ) : loading && customers.length === 0 ? (
        <TableSkeleton cols={6} />
      ) : (
        <>
          <DataTable
            columns={["Customer", "Contact", "Orders", "Lifetime value", "Role", "Joined", "Actions"]}
            empty={customers.length === 0}
          >
            {customers.map((customer) => (
              <tr key={customer.id} className="transition hover:bg-cream-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chai-100 text-xs font-bold text-chai-700">
                      {initials(customer.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-charcoal-900">{customer.name}</p>
                      {!customer.isActive && <Badge tone="red">Deactivated</Badge>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="truncate text-xs text-charcoal-600">{customer.email}</p>
                  {customer.phone && <p className="text-xs text-charcoal-400">{customer.phone}</p>}
                </td>
                <td className="px-4 py-3 text-charcoal-600">{customer.orderCount}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-charcoal-900">
                  {money(customer.totalSpent)}
                </td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Role for ${customer.name}`}
                    value={customer.role}
                    disabled={!canManage || customer.id === user?.id || updating === customer.id || deletingBusy}
                    onChange={(e) => void update(customer, { role: e.target.value as Customer["role"] })}
                    className="rounded-lg border border-cream-300 bg-surface px-2 py-1.5 text-xs font-medium text-charcoal-700"
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="STAFF">Staff</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-charcoal-400">
                  {formatDate(customer.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={customer.isActive ? "secondary" : "primary"}
                    loading={updating === customer.id}
                    disabled={!canManage || customer.id === user?.id || deletingBusy}
                    onClick={() => void update(customer, { isActive: !customer.isActive })}
                  >
                    {customer.isActive ? (
                      <><ShieldOff className="h-3.5 w-3.5" aria-hidden /> Deactivate</>
                    ) : (
                      <><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Activate</>
                    )}
                  </Button>
                  {canManage && customer.role === "CUSTOMER" && (
                    <button type="button" onClick={() => setDeleting(customer)} disabled={updating === customer.id || deletingBusy}
                      aria-label={`Delete customer ${customer.name}`} title={`Delete ${customer.name}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-chilli-500 transition hover:bg-chilli-400/10 hover:text-chilli-600 disabled:opacity-40">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>Previous</Button>
              <span className="text-sm text-charcoal-500">Page {page} of {totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => void load(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
      <Modal open={Boolean(deleting)} onClose={() => { if (!deletingBusy) setDeleting(null); }} title="Delete customer?">
        {deleting && (
          <div className="space-y-4">
            <div className="rounded-xl border border-cream-200 bg-cream-50 p-4">
              <p className="break-words font-semibold">{deleting.name}</p>
              <p className="mt-1 break-all text-sm text-charcoal-500">{deleting.email}</p>
              <p className="mt-2 text-xs text-charcoal-500">{deleting.orderCount} previous orders · {money(deleting.totalSpent)}</p>
            </div>
            <p className="text-sm text-charcoal-600">This permanently removes the account, saved addresses, favourites and reviews. The customer will no longer be able to sign in.</p>
            <p className="text-sm font-medium text-charcoal-700">Previous orders, receipts and sales records will be kept.</p>
            <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-4">
              <Button variant="secondary" disabled={deletingBusy} onClick={() => setDeleting(null)}>Keep customer</Button>
              <Button variant="danger" loading={deletingBusy} onClick={() => void confirmDelete()}><Trash2 className="h-4 w-4" aria-hidden /> Delete customer</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

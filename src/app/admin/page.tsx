import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/dashboard";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/lib/prisma";
export const metadata: Metadata={title:"Dashboard"};
export default async function Page(){const actor=await getCurrentUser();if(actor?.businessProfile==='WAITER')redirect('/admin/business?section=tables');if(actor?.businessProfile==='CHEF')redirect('/admin/kitchen');if(actor?.businessProfile==='CASHIER')redirect('/admin/pos');const config=await prisma.businessConfig.findUnique({where:{id:1}});if(config?.enabled&&(actor?.role==='ADMIN'||actor?.businessProfile==='MANAGER'))redirect('/admin/business?section=overview');return <><div className="surface mb-5 flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-bold">Cafe business system</p><p className="text-sm text-charcoal-500">Set up ingredients, recipes, staff and opening balances.</p></div><Link className="btn-primary" href="/admin/business">Open cafe office</Link></div><AdminDashboard/></>}

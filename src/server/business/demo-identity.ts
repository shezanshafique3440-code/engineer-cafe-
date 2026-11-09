import "server-only";
import type { DB } from "./core";
import { badRequest } from "@/server/api";
/** Names and DEMO labels are not proof. New records need the captured manifest;
 * old deterministic IDs additionally require their known importer receipt. */
export async function isDemoEntity(
  tx: DB,
  tableName: string,
  recordId: string,
) {
  if (
    await tx.demoRecord.findUnique({
      where: { tableName_recordId: { tableName, recordId } },
    })
  )
    return true;
  const marker = recordId.startsWith("cafe-demo-v1-")
    ? "business-demo-v1"
    : recordId.startsWith("cafe-practice-v1-")
      ? "business-practice-v1"
      : null;
  return marker
    ? Boolean(await tx.businessRequest.findUnique({ where: { key: marker } }))
    : false;
}
export async function assertDemoMoney(
  tx: DB,
  table: string,
  id: string,
  account: { id: string; code: string },
) {
  if (!(await isDemoEntity(tx, table, id))) return;
  if (account.code === "RIDER_CASH") return; // shared control; every receipt still has its demo order/rider
  if (!(await isDemoEntity(tx, "BusinessAccount", account.id)))
    throw badRequest(
      "This is a DEMO record. Choose a DEMO cash, bank or wallet account so cleanup can preserve real money.",
    );
}
export async function handoverAccount(
  tx: DB,
  order: { id: string; orderType: string; cashShiftId: string | null },
) {
  if (order.orderType === "DELIVERY") return "RIDER_CASH";
  if (!(await isDemoEntity(tx, "Order", order.id))) return "CASH_MAIN";
  const shift = order.cashShiftId
    ? await tx.cashShift.findUnique({
        where: { id: order.cashShiftId },
        include: { drawer: { include: { account: true } } },
      })
    : null;
  if (
    !shift ||
    !(await isDemoEntity(tx, "BusinessAccount", shift.drawer.accountId))
  )
    throw badRequest(
      "Choose a DEMO account and record this test payment before handover.",
    );
  return shift.drawer.accountId;
}

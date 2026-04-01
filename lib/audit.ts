// Audit log helper — call inside prisma.$transaction() to ensure atomicity
import { PrismaClient } from "@prisma/client";
import type { AuditAction } from "@/types";

// Accepts either a full PrismaClient or a transaction client (Omit pattern)
type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function createAuditLog(
  client: TxClient | PrismaClient,
  userId: string,
  action: AuditAction,
  model: string,
  recordId: string,
  changes?: Record<string, unknown>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).auditLog.create({
    data: {
      userId,
      action,
      model,
      recordId,
      changes: changes ?? undefined,
    },
  });
}

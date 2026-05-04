// PATCH + DELETE for an individual party deposit.
// RBAC mirrors sibling list route (hasPartyAccess / partyModules).
// All mutations run inside prisma.$transaction with usage-aware guards.
//
// NOTE: hasPartyAccess + partyModules are copy-pasted from sibling route.ts
// because they are simple enough to inline and no shared lib/party-access.ts exists yet.
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { diffForAudit } from "@/lib/audit-diff";
import { updateDepositSchema } from "@/lib/validation-schemas";
import type { RbacAction, RbacModule } from "@/types";
import { MSG, depositAmountBelowUsed } from "@/lib/messages";
import { TAG } from "@/lib/cache/keys";
import { invalidateTags } from "@/lib/cache/invalidate";
import {
  loadDepositUsageStats,
  assertCanEditMetadata,
  assertNewAmountValid,
  assertCanDelete,
  DepositEditError,
} from "@/lib/deposit-edit-guard";
import Decimal from "decimal.js";

// ---- RBAC helpers (duplicated from sibling — extract to lib/party-access.ts if needed again) ----

function partyModules(type: string): RbacModule[] {
  if (type === "CUSTOMER") return ["CUSTOMER"];
  if (type === "SUPPLIER") return ["SUPPLIER"];
  return ["CUSTOMER", "SUPPLIER"];
}

function hasPartyAccess(roles: string[], action: RbacAction, type: string): boolean {
  const modules = partyModules(type);
  if (action === "GET") return modules.some((mod) => checkAccess(roles, action, mod));
  return modules.every((mod) => checkAccess(roles, action, mod));
}

// ---- PATCH ----

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; depositId: string }> }
) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id: partyId, depositId } = await params;

  try {
    const party = await prisma.party.findFirst({ where: { id: partyId, isActive: true } });
    if (!party) {
      return Response.json(apiResponse(false, undefined, MSG.partyNotFound), { status: 404 });
    }

    if (!hasPartyAccess(session.user.roles, "UPDATE", party.type)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    // Scope deposit to this party — 404 if it belongs to a different party or doesn't exist
    const existing = await prisma.deposit.findFirst({
      where: { id: depositId, partyId },
      include: {
        currency: { select: { id: true, code: true, symbol: true } },
        businessUnit: { select: { id: true, code: true, name: true } },
      },
    });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, MSG.depositNotFound), { status: 404 });
    }

    const body = await request.json();
    const validation = updateDepositSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
        { status: 400 }
      );
    }

    const { currencyId, amountOriginal: newAmountStr, businessUnitId, notes } = validation.data;

    // Require at least one field
    if (currencyId === undefined && newAmountStr === undefined && businessUnitId === undefined && notes === undefined) {
      return Response.json(
        apiResponse(false, undefined, "Không có trường nào để cập nhật"),
        { status: 400 }
      );
    }

    // Verify referenced entities are active before entering transaction
    if (currencyId !== undefined) {
      const currency = await prisma.currency.findFirst({ where: { id: currencyId, isActive: true } });
      if (!currency) {
        return Response.json(apiResponse(false, undefined, MSG.currencyNotFound), { status: 404 });
      }
    }
    if (businessUnitId !== undefined) {
      const bu = await prisma.businessUnit.findFirst({ where: { id: businessUnitId, isActive: true } });
      if (!bu) {
        return Response.json(apiResponse(false, undefined, MSG.businessUnitNotFound), { status: 404 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const stats = await loadDepositUsageStats(tx as Parameters<typeof loadDepositUsageStats>[0], depositId);

      // Guard: currency / BU locked once any DepositUsage exists
      if (currencyId !== undefined || businessUnitId !== undefined) {
        assertCanEditMetadata(stats);
      }

      // Guard: new amount must not go below already-deducted sum
      if (newAmountStr !== undefined) {
        assertNewAmountValid(newAmountStr, stats);
      }

      // Build update payload
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {};

      if (newAmountStr !== undefined) {
        const newAmount = new Decimal(newAmountStr);
        const oldAmount = new Decimal(existing.amountOriginal.toString());
        const delta = newAmount.minus(oldAmount);
        updateData.amountOriginal = newAmount.toFixed(4);
        // Prisma accepts numeric increment — handles both positive and negative delta
        updateData.remainingOriginal = { increment: delta.toFixed(4) };
      }
      if (currencyId !== undefined) updateData.currencyId = currencyId;
      if (businessUnitId !== undefined) updateData.businessUnitId = businessUnitId;
      if (notes !== undefined) updateData.notes = notes?.trim() || null;

      const updated = await (tx as any).deposit.update({
        where: { id: depositId },
        data: updateData,
        include: {
          currency: { select: { id: true, code: true, symbol: true } },
          businessUnit: { select: { id: true, code: true, name: true } },
        },
      });

      // Audit diff: compare incoming fields against existing snapshot
      const incomingSnapshot: Record<string, unknown> = {};
      if (newAmountStr !== undefined) incomingSnapshot.amountOriginal = newAmountStr;
      if (currencyId !== undefined) incomingSnapshot.currencyId = currencyId;
      if (businessUnitId !== undefined) incomingSnapshot.businessUnitId = businessUnitId;
      if (notes !== undefined) incomingSnapshot.notes = notes?.trim() || null;

      const existingSnapshot: Record<string, unknown> = {
        amountOriginal: existing.amountOriginal.toString(),
        currencyId: existing.currencyId,
        businessUnitId: existing.businessUnitId,
        notes: existing.notes,
      };

      await createAuditLog(
        tx as any,
        session.user.id!,
        "UPDATE",
        "Deposit",
        depositId,
        diffForAudit(incomingSnapshot, existingSnapshot)
      );

      return updated;
    });

    // Invalidate — if BU changed, clear both old and new BU report tags
    const tagsToInvalidate = [TAG.partyDeposits(partyId), TAG.party(partyId)];
    tagsToInvalidate.push(TAG.reportsByBu(existing.businessUnitId));
    if (businessUnitId && businessUnitId !== existing.businessUnitId) {
      tagsToInvalidate.push(TAG.reportsByBu(businessUnitId));
    }
    invalidateTags(tagsToInvalidate);

    return Response.json(apiResponse(true, result));
  } catch (error) {
    if (error instanceof DepositEditError) {
      if (error.code === "LOCKED_HAS_USAGES") {
        return Response.json(apiResponse(false, undefined, MSG.depositLockedHasUsages), { status: 400 });
      }
      if (error.code === "AMOUNT_BELOW_USED") {
        const used = (error.meta.used as string | undefined) ?? "";
        return Response.json(
          apiResponse(false, undefined, depositAmountBelowUsed(used), { amountOriginal: [depositAmountBelowUsed(used)] }),
          { status: 400 }
        );
      }
    }
    console.error("PATCH /api/parties/[id]/deposits/[depositId] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

// ---- DELETE ----

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; depositId: string }> }
) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { id: partyId, depositId } = await params;

  try {
    const party = await prisma.party.findFirst({ where: { id: partyId, isActive: true } });
    if (!party) {
      return Response.json(apiResponse(false, undefined, MSG.partyNotFound), { status: 404 });
    }

    if (!hasPartyAccess(session.user.roles, "DELETE", party.type)) {
      return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
    }

    const existing = await prisma.deposit.findFirst({ where: { id: depositId, partyId } });
    if (!existing) {
      return Response.json(apiResponse(false, undefined, MSG.depositNotFound), { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const stats = await loadDepositUsageStats(tx as Parameters<typeof loadDepositUsageStats>[0], depositId);
      assertCanDelete(stats);

      await (tx as any).deposit.delete({ where: { id: depositId } });

      // Audit: record full snapshot at deletion time
      await createAuditLog(
        tx as any,
        session.user.id!,
        "DELETE",
        "Deposit",
        depositId,
        {
          partyId: existing.partyId,
          businessUnitId: existing.businessUnitId,
          currencyId: existing.currencyId,
          amountOriginal: existing.amountOriginal.toString(),
          remainingOriginal: existing.remainingOriginal.toString(),
        }
      );
    });

    invalidateTags([
      TAG.partyDeposits(partyId),
      TAG.party(partyId),
      TAG.reportsByBu(existing.businessUnitId),
    ]);

    return Response.json(apiResponse(true, undefined, "Xóa cọc thành công"));
  } catch (error) {
    if (error instanceof DepositEditError && error.code === "DELETE_BLOCKED_HAS_USAGES") {
      return Response.json(
        apiResponse(false, undefined, MSG.depositDeleteBlockedHasUsages),
        { status: 409 }
      );
    }
    console.error("DELETE /api/parties/[id]/deposits/[depositId] error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

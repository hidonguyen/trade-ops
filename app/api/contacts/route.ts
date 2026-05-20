// Contacts (Người Nộp/Nhận) — list + create.
// Read open to authenticated users; write allowed for anyone with CREATE on
// RECEIPT or PAYMENT in any BU (covers ADMIN + ACCOUNTANT_CASHFLOW + ACCOUNTANT_SALE/PURCHASE).
import { withAuth, apiResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createContactSchema } from "@/lib/validation-schemas";
import { MSG } from "@/lib/messages";
import { withCache } from "@/lib/cache/with-cache";
import { contactsKey, TAG, TTL } from "@/lib/cache/keys";
import { invalidateTags } from "@/lib/cache/invalidate";
import { canWriteContact } from "@/lib/contact-access";

export async function GET(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const includeInactive = searchParams.get("includeInactive") === "true";
  const businessUnitId = searchParams.get("businessUnitId") || null;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));

  const querySig = `q=${q}|active=${includeInactive}|bu=${businessUnitId ?? "all"}|p=${page}|s=${pageSize}`;

  try {
    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      // Multi-BU: when caller supplies a BU, only return contacts linked to it.
      ...(businessUnitId ? { businessUnits: { some: { businessUnitId } } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    };

    const data = await withCache(
      { key: contactsKey(querySig), tags: [TAG.contacts], ttlMs: TTL.catalog },
      async () => {
        const [items, total] = await Promise.all([
          prisma.contact.findMany({
            where,
            include: {
              businessUnits: {
                select: { businessUnit: { select: { id: true, code: true, name: true } } },
              },
            },
            orderBy: [{ isActive: "desc" }, { name: "asc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.contact.count({ where }),
        ]);
        return { items, total, page, pageSize };
      }
    );

    return Response.json(apiResponse(true, data));
  } catch (error) {
    console.error("GET /api/contacts error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) {
    return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  }
  if (!canWriteContact(session.user.roles, "CREATE")) {
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });
  }

  const body = await request.json();
  const validation = createContactSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, MSG.validationFailed, validation.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 400 }
    );
  }

  // Coerce empty strings to null so the DB stores NULL instead of "".
  const { businessUnitIds, ...rest } = validation.data;
  const data = normalizeContactInput(rest);

  // Resolve BU list: omit/empty → "Chung tất cả BU" = every active BU.
  let buIds = businessUnitIds && businessUnitIds.length > 0 ? [...new Set(businessUnitIds)] : null;
  if (buIds === null) {
    const activeBus = await prisma.businessUnit.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    buIds = activeBus.map((b) => b.id);
  }

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const created = await tx.contact.create({ data });
      if (buIds.length > 0) {
        await tx.contactBusinessUnit.createMany({
          data: buIds.map((id) => ({ contactId: created.id, businessUnitId: id })),
          skipDuplicates: true,
        });
      }
      await createAuditLog(
        tx,
        session.user.id!,
        "CREATE",
        "Contact",
        created.id,
        { ...data, businessUnitIds: buIds } as Record<string, unknown>,
      );
      return created;
    });
    invalidateTags([TAG.contacts]);
    return Response.json(apiResponse(true, result), { status: 201 });
  } catch (error) {
    console.error("POST /api/contacts error:", error);
    return Response.json(apiResponse(false, undefined, MSG.internalError), { status: 500 });
  }
}

// Empty optional strings → null to keep DB tidy and avoid bogus "" matches in search.
function normalizeContactInput(input: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...input };
  for (const k of ["phone", "email", "taxId", "address", "notes"]) {
    if (out[k] === "") out[k] = null;
  }
  return out;
}

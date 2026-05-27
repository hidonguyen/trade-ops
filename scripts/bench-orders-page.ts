// Benchmark the /api/orders query path (mirrors app/api/orders/route.ts GET).
// Measures cold + 5 warm runs of the exact prisma.findMany + count Promise.all
// the page triggers on initial load.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const orderIncludes = {
  party: { select: { id: true, name: true, type: true } },
  currency: { select: { id: true, code: true, symbol: true } },
  businessUnit: { select: { id: true, code: true, name: true } },
  expenseType: { select: { id: true, name: true, isActive: true } },
};

async function bench(label: string, fn: () => Promise<unknown>) {
  const t = Date.now();
  const r = await fn();
  const ms = Date.now() - t;
  console.log(`${label}: ${ms}ms`);
  return { ms, r };
}

async function main() {
  // Resolve TK BU (mirrors what the page passes once user selects a BU)
  const tk = await prisma.businessUnit.findUnique({ where: { code: "TK" } });
  if (!tk) throw new Error("BU TK not found — run perf-seed first");
  const buId = tk.id;

  // No filters set initially other than BU + default dateRange (none after restore — fresh user)
  const where = {
    type: { in: ["SALE", "PURCHASE"] },
    businessUnitId: buId,
  };

  const runQuery = () =>
    Promise.all([
      prisma.order.findMany({
        where,
        include: {
          ...orderIncludes,
          transactions: { where: { paymentType: "ADJUSTMENT" }, select: { amountOriginal: true } },
        },
        orderBy: [{ orderDate: "desc" as const }, { orderNumber: "asc" as const }],
        skip: 0,
        take: 25,
      }),
      prisma.order.count({ where }),
    ]);

  console.log(`BU: ${tk.code} (${buId})`);
  console.log(`Total orders in DB: ${(await prisma.order.count()).toLocaleString()}\n`);

  console.log("=== Initial load (page=1, limit=25, no filters) ===");
  await bench("cold run", runQuery);
  for (let i = 1; i <= 5; i++) await bench(`warm  ${i}`, runQuery);

  // With date filter (last 30 days) — typical filtered view
  console.log("\n=== With orderDate filter (last 30 days) ===");
  const from = new Date(); from.setDate(from.getDate() - 30);
  const whereFiltered = { ...where, orderDate: { gte: from } };
  const runFiltered = () =>
    Promise.all([
      prisma.order.findMany({
        where: whereFiltered,
        include: {
          ...orderIncludes,
          transactions: { where: { paymentType: "ADJUSTMENT" }, select: { amountOriginal: true } },
        },
        orderBy: [{ orderDate: "desc" as const }, { orderNumber: "asc" as const }],
        skip: 0, take: 25,
      }),
      prisma.order.count({ where: whereFiltered }),
    ]);
  await bench("cold filtered", runFiltered);
  for (let i = 1; i <= 3; i++) await bench(`warm  ${i}`, runFiltered);

  // Deep pagination (page=1000 — page 1000 of 25 = skip 24975)
  console.log("\n=== Deep pagination (page=1000, skip=24975) ===");
  const runDeep = () =>
    Promise.all([
      prisma.order.findMany({
        where,
        include: { ...orderIncludes, transactions: { where: { paymentType: "ADJUSTMENT" }, select: { amountOriginal: true } } },
        orderBy: [{ orderDate: "desc" as const }, { orderNumber: "asc" as const }],
        skip: 24975, take: 25,
      }),
      prisma.order.count({ where }),
    ]);
  await bench("deep cold", runDeep);
  for (let i = 1; i <= 3; i++) await bench(`warm  ${i}`, runDeep);
}

main().catch(console.error).finally(() => prisma.$disconnect());

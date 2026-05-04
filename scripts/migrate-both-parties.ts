// Migrate Party.type = 'BOTH' → 'CUSTOMER' or 'SUPPLIER' based on Order activity.
//
// Disambiguator: Order.type SALE = customer-side, PURCHASE = supplier-side.
// (Deposit has no role field — cannot disambiguate; ignored.)
// Tie → CUSTOMER (revenue-side bias, per plan).
//
// Run:
//   npx tsx scripts/migrate-both-parties.ts            # dry-run, writes CSV
//   npx tsx scripts/migrate-both-parties.ts --apply    # writes CSV + updates DB

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const APPLY = process.argv.includes("--apply");
const CSV_PATH =
  "plans/260504-2230-remove-both-party-type/reports/migration-decisions.csv";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type Decision = {
  partyId: string;
  name: string;
  businessUnitId: string;
  saleCount: number;
  purchaseCount: number;
  chosenType: "CUSTOMER" | "SUPPLIER";
};

async function main() {
  const mode = APPLY ? "APPLY" : "DRY-RUN";
  console.log(`[${mode}] Loading parties with type='BOTH'...`);

  const both = await prisma.party.findMany({
    where: { type: "BOTH" },
    select: { id: true, name: true, businessUnitId: true },
    orderBy: { name: "asc" },
  });

  if (both.length === 0) {
    console.log("No BOTH parties found. Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${both.length} BOTH parties. Scoring...`);

  const decisions: Decision[] = [];
  for (const p of both) {
    const [sale, purchase] = await Promise.all([
      prisma.order.count({ where: { partyId: p.id, type: "SALE" } }),
      prisma.order.count({ where: { partyId: p.id, type: "PURCHASE" } }),
    ]);
    // Tie or both zero → CUSTOMER (revenue-side bias)
    const chosenType: "CUSTOMER" | "SUPPLIER" =
      purchase > sale ? "SUPPLIER" : "CUSTOMER";
    decisions.push({
      partyId: p.id,
      name: p.name,
      businessUnitId: p.businessUnitId,
      saleCount: sale,
      purchaseCount: purchase,
      chosenType,
    });
  }

  // CSV
  const csv = [
    "party_id,name,business_unit_id,sale_count,purchase_count,chosen_type",
    ...decisions.map((d) =>
      [
        d.partyId,
        `"${d.name.replace(/"/g, '""')}"`,
        d.businessUnitId,
        d.saleCount,
        d.purchaseCount,
        d.chosenType,
      ].join(","),
    ),
  ].join("\n");
  mkdirSync(dirname(CSV_PATH), { recursive: true });
  writeFileSync(CSV_PATH, csv);
  console.log(`CSV decision log: ${CSV_PATH}`);

  // Summary
  const customers = decisions.filter((d) => d.chosenType === "CUSTOMER").length;
  const suppliers = decisions.filter((d) => d.chosenType === "SUPPLIER").length;
  console.log(`Summary: ${customers} → CUSTOMER, ${suppliers} → SUPPLIER`);
  console.table(
    decisions.slice(0, 20).map((d) => ({
      name: d.name,
      sale: d.saleCount,
      purchase: d.purchaseCount,
      chosen: d.chosenType,
    })),
  );
  if (decisions.length > 20)
    console.log(`(... ${decisions.length - 20} more in CSV)`);

  if (!APPLY) {
    console.log("\nDry-run complete. Re-run with --apply to update DB.");
    await prisma.$disconnect();
    return;
  }

  console.log("\n[APPLY] Updating Party.type in transaction...");
  await prisma.$transaction(
    decisions.map((d) =>
      prisma.party.update({
        where: { id: d.partyId },
        data: { type: d.chosenType },
      }),
    ),
  );

  const remaining = await prisma.party.count({ where: { type: "BOTH" } });
  if (remaining !== 0) {
    throw new Error(`Post-apply check failed: ${remaining} BOTH rows remain`);
  }
  console.log("Verified: 0 BOTH rows remain.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

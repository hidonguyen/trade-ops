// Performance seed: clears DB, runs base seed, bulk inserts 10k parties + 10k contacts + 1M orders.
// Uses raw SQL with generate_series for speed (Prisma createMany is too slow at this scale).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const N_PARTIES = 10_000;
const N_CONTACTS = 10_000;
const N_ORDERS = 1_000_000;

function ms(start: number) {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

async function truncateAll() {
  // Order matters — child tables first
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "DepositUsage","Transaction","Order","Deposit",
      "PartyBusinessUnit","ContactBusinessUnit","Party","Contact",
      "AuditLog","UserRoleAssignment","ExpenseType","Currency","BusinessUnit","User"
    RESTART IDENTITY CASCADE;
  `);
}

async function baseSeed() {
  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.create({
    data: { email: "admin@example.com", name: "Admin", passwordHash },
  });
  await prisma.userRoleAssignment.create({
    data: { userId: admin.id, role: "ADMIN", assignedBy: admin.id },
  });

  const tk = await prisma.businessUnit.create({ data: { code: "TK", name: "Trang Khanh" } });
  const nt = await prisma.businessUnit.create({ data: { code: "NT", name: "Ngọc Trinh" } });

  const saleUser = await prisma.user.create({
    data: { email: "sale.tk@example.com", name: "Sale TK", passwordHash },
  });
  await prisma.userRoleAssignment.create({
    data: { userId: saleUser.id, role: "ACCOUNTANT_SALE", businessUnitId: tk.id, assignedBy: admin.id },
  });

  const vnd = await prisma.currency.create({ data: { code: "VND", name: "Việt Nam Đồng", symbol: "₫" } });
  await prisma.currency.create({ data: { code: "USD", name: "US Dollar", symbol: "$" } });
  await prisma.currency.create({ data: { code: "RMB", name: "Nhân Dân Tệ", symbol: "¥" } });

  const expenseTypeNames = [
    "Tiện ích","Lương","Thuê mặt bằng","Vận chuyển","Hải quan","Khác",
    "Mua vật tư","Chi phí tiện ích","Chi phí khác","Phí ngân hàng","Cọc",
  ];
  for (const name of expenseTypeNames) {
    await prisma.expenseType.create({ data: { name } });
  }

  return { adminId: admin.id, tkId: tk.id, ntId: nt.id, vndId: vnd.id };
}

async function bulkParties(tkId: string, ntId: string) {
  // 5k parties anchored to TK, 5k to NT. All shared to both BUs via PartyBusinessUnit.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Party" (id, "businessUnitId", name, type, "isActive", "createdAt", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      CASE WHEN i <= ${N_PARTIES / 2} THEN '${tkId}' ELSE '${ntId}' END,
      'Party ' || i,
      CASE WHEN i % 2 = 0 THEN 'CUSTOMER' ELSE 'SUPPLIER' END,
      true, NOW(), NOW()
    FROM generate_series(1, ${N_PARTIES}) AS i;
  `);
  // Share each party with its own BU (origin link)
  await prisma.$executeRawUnsafe(`
    INSERT INTO "PartyBusinessUnit" ("partyId", "businessUnitId")
    SELECT id, "businessUnitId" FROM "Party";
  `);
}

async function bulkContacts(tkId: string, ntId: string) {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Contact" (id, name, phone, "isActive", "createdAt", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      'Contact ' || i,
      '09' || LPAD(i::text, 8, '0'),
      true, NOW(), NOW()
    FROM generate_series(1, ${N_CONTACTS}) AS i;
  `);
  // Spread contacts: half to TK, half to NT
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ContactBusinessUnit" ("contactId", "businessUnitId")
    SELECT
      c.id,
      CASE WHEN (row_number() OVER (ORDER BY c.id)) <= ${N_CONTACTS / 2}
        THEN '${tkId}' ELSE '${ntId}' END
    FROM "Contact" c;
  `);
}

async function bulkOrders(vndId: string, adminId: string) {
  // 1M orders distributed across parties. Each party gets ~N_ORDERS/N_PARTIES orders.
  // orderNumber must be unique per (businessUnitId, partyId).
  const perParty = Math.ceil(N_ORDERS / N_PARTIES); // 100
  // Batch insert in chunks of 100k rows to avoid memory pressure
  const BATCH = 100_000;
  for (let offset = 0; offset < N_ORDERS; offset += BATCH) {
    const start = offset + 1;
    const end = Math.min(offset + BATCH, N_ORDERS);
    const batchStart = Date.now();
    await prisma.$executeRawUnsafe(`
      WITH parties_ranked AS (
        SELECT id AS pid, "businessUnitId" AS buid,
               row_number() OVER (ORDER BY id) - 1 AS rn
        FROM "Party"
      )
      INSERT INTO "Order" (
        id, "businessUnitId", "partyId", "orderNumber", type, status,
        "amountOriginal", "currencyId", "exchangeRate", "orderDate",
        "paidAmount", "refundedAmount", "createdBy", "createdAt", "updatedAt"
      )
      SELECT
        gen_random_uuid()::text,
        p.buid,
        p.pid,
        'ORD-' || ((i - 1) % ${perParty} + 1)::text,
        CASE WHEN i % 2 = 0 THEN 'SALE' ELSE 'PURCHASE' END,
        'UNPAID',
        ((i % 1000) + 1) * 1000,
        '${vndId}',
        1,
        NOW() - ((i % 365) || ' days')::interval,
        0, 0,
        '${adminId}',
        NOW(), NOW()
      FROM generate_series(${start}, ${end}) AS i
      JOIN parties_ranked p ON p.rn = ((i - 1) / ${perParty}) % ${N_PARTIES};
    `);
    console.log(`  orders ${end.toLocaleString()}/${N_ORDERS.toLocaleString()} (+${ms(batchStart)})`);
  }
}

async function main() {
  const t0 = Date.now();
  console.log("[1/5] Truncating all tables...");
  await truncateAll();
  console.log(`     done ${ms(t0)}`);

  console.log("[2/5] Base seed (users, BUs, currencies, expense types)...");
  const t1 = Date.now();
  const { adminId, tkId, ntId, vndId } = await baseSeed();
  console.log(`     done ${ms(t1)}`);

  console.log(`[3/5] Inserting ${N_PARTIES.toLocaleString()} parties...`);
  const t2 = Date.now();
  await bulkParties(tkId, ntId);
  console.log(`     done ${ms(t2)}`);

  console.log(`[4/5] Inserting ${N_CONTACTS.toLocaleString()} contacts...`);
  const t3 = Date.now();
  await bulkContacts(tkId, ntId);
  console.log(`     done ${ms(t3)}`);

  console.log(`[5/5] Inserting ${N_ORDERS.toLocaleString()} orders...`);
  const t4 = Date.now();
  await bulkOrders(vndId, adminId);
  console.log(`     done ${ms(t4)}`);

  // Final counts
  const [parties, contacts, orders] = await Promise.all([
    prisma.party.count(),
    prisma.contact.count(),
    prisma.order.count(),
  ]);
  console.log("\n=== Summary ===");
  console.log(`Parties:  ${parties.toLocaleString()}`);
  console.log(`Contacts: ${contacts.toLocaleString()}`);
  console.log(`Orders:   ${orders.toLocaleString()}`);
  console.log(`Total time: ${ms(t0)}`);
  console.log("\nLogin: admin@example.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

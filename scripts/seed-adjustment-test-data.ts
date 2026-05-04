// Seed script for Phase 09 edge case testing: orders with adjustments, deposits, bank fees
// Run: npx tsx scripts/seed-adjustment-test-data.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding adjustment test data...");

  // Get required IDs
  const tkBU = await prisma.businessUnit.findUnique({ where: { code: "TK" } });
  if (!tkBU) throw new Error("Business unit TK not found — run main seed first");

  const usdCur = await prisma.currency.findUnique({ where: { code: "USD" } });
  const vndCur = await prisma.currency.findUnique({ where: { code: "VND" } });
  const rmbCur = await prisma.currency.findUnique({ where: { code: "RMB" } });
  if (!usdCur || !vndCur || !rmbCur) throw new Error("Missing currencies");

  const expTypes = await prisma.expenseType.findMany();
  const phiNganHang = expTypes.find((e) => e.name === "Phí ngân hàng");
  const muaVatTu = expTypes.find((e) => e.name === "Mua vật tư");
  const chiphhh = expTypes.find((e) => e.name === "Chi phí tiện ích");
  if (!phiNganHang || !muaVatTu || !chiphhh) throw new Error("Missing expense types");

  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });
  if (!adminUser) throw new Error("Admin user not found");

  // 1. Customer "KH001 Test" with 3 orders (USD, VND, RMB) — covers §6.1
  let kh001 = await prisma.party.findFirst({
    where: { businessUnitId: tkBU.id, name: "KH001 Test" },
  });
  if (!kh001) {
    kh001 = await prisma.party.create({
      data: {
        businessUnitId: tkBU.id,
        name: "KH001 Test",
        type: "CUSTOMER",
      },
    });
  }

  // KH001 - USD order (50M USD, 0 payment = zero-payment case §6.2)
  const order001 = await prisma.order.upsert({
    where: {
      businessUnitId_partyId_orderNumber: {
        businessUnitId: tkBU.id,
        partyId: kh001.id,
        orderNumber: "008-ND",
      },
    },
    update: {},
    create: {
      businessUnitId: tkBU.id,
      partyId: kh001.id,
      orderNumber: "008-ND",
      type: "SALE",
      status: "UNPAID",
      amountOriginal: 50,
      currencyId: usdCur.id,
      exchangeRate: 24.5, // 1 USD = 24.5k VND
      orderDate: new Date("2026-04-01"),
      paymentDueDate: new Date("2026-05-01"),
      createdBy: adminUser.id,
    },
  });

  // KH001 - VND order (fully paid case §6.3: 50M + 1 payment 50M)
  const order002 = await prisma.order.upsert({
    where: {
      businessUnitId_partyId_orderNumber: {
        businessUnitId: tkBU.id,
        partyId: kh001.id,
        orderNumber: "009-TM",
      },
    },
    update: {},
    create: {
      businessUnitId: tkBU.id,
      partyId: kh001.id,
      orderNumber: "009-TM",
      type: "SALE",
      status: "PAID",
      amountOriginal: 50_000_000,
      currencyId: vndCur.id,
      exchangeRate: 1,
      orderDate: new Date("2026-04-02"),
      paymentDueDate: new Date("2026-05-02"),
      createdBy: adminUser.id,
    },
  });

  // Add payment to 009-TM
  const payment002 = await prisma.transaction.upsert({
    where: { id: "payment002-kh001-vnd" }, // synthetic unique for upsert
    update: {},
    create: {
      id: "payment002-kh001-vnd",
      orderId: order002.id,
      businessUnitId: tkBU.id,
      type: "SALE_PAYMENT",
      paymentMethod: "BANK",
      paymentType: "PAYMENT",
      amountOriginal: 50_000_000,
      currencyId: vndCur.id,
      amountVnd: 50_000_000,
      exchangeRate: 1,
      bankReference: "NHH-VND-001",
      transactionDate: new Date("2026-04-10"),
      createdBy: adminUser.id,
    },
  });

  // KH001 - RMB order (partial paid + adjustment case §6.4: 100M + 1 payment 60M + adjustment -10M)
  const order003 = await prisma.order.upsert({
    where: {
      businessUnitId_partyId_orderNumber: {
        businessUnitId: tkBU.id,
        partyId: kh001.id,
        orderNumber: "001-TN",
      },
    },
    update: {},
    create: {
      businessUnitId: tkBU.id,
      partyId: kh001.id,
      orderNumber: "001-TN",
      type: "SALE",
      status: "PARTIAL_PAID",
      amountOriginal: 100,
      currencyId: rmbCur.id,
      exchangeRate: 3.5, // 1 RMB = 3.5k VND
      orderDate: new Date("2026-04-03"),
      paymentDueDate: new Date("2026-05-03"),
      createdBy: adminUser.id,
    },
  });

  // Payment on 001-TN: 60M RMB
  const payment003a = await prisma.transaction.upsert({
    where: { id: "payment003a-kh001-rmb" },
    update: {},
    create: {
      id: "payment003a-kh001-rmb",
      orderId: order003.id,
      businessUnitId: tkBU.id,
      type: "SALE_PAYMENT",
      paymentMethod: "BANK",
      paymentType: "PAYMENT",
      amountOriginal: 60,
      currencyId: rmbCur.id,
      amountVnd: 210_000, // 60 * 3.5k
      exchangeRate: 3.5,
      bankReference: "NHH-RMB-001",
      transactionDate: new Date("2026-04-15"),
      createdBy: adminUser.id,
    },
  });

  // Adjustment on 001-TN: -10M (negative adjustment = §6.4)
  const adjustment003 = await prisma.transaction.upsert({
    where: { id: "adjustment003-kh001-rmb" },
    update: {},
    create: {
      id: "adjustment003-kh001-rmb",
      orderId: order003.id,
      businessUnitId: tkBU.id,
      type: "SALE_PAYMENT", // Using SALE_PAYMENT type; paymentType will distinguish
      paymentMethod: "BANK",
      paymentType: "ADJUSTMENT", // Sentinel: marks this as adjustment
      amountOriginal: -10, // Negative
      currencyId: rmbCur.id,
      amountVnd: -35_000, // -10 * 3.5k
      exchangeRate: 3.5,
      transactionDate: new Date("2026-04-20"),
      createdBy: adminUser.id,
    },
  });

  // 2. USD order with legacy exchangeRate=1 (pre-migration) — §6.6
  const order004 = await prisma.order.upsert({
    where: {
      businessUnitId_partyId_orderNumber: {
        businessUnitId: tkBU.id,
        partyId: kh001.id,
        orderNumber: "999-LEGACY",
      },
    },
    update: {},
    create: {
      businessUnitId: tkBU.id,
      partyId: kh001.id,
      orderNumber: "999-LEGACY",
      type: "SALE",
      status: "UNPAID",
      amountOriginal: 100,
      currencyId: usdCur.id,
      exchangeRate: 1, // Legacy pre-migration state
      orderDate: new Date("2025-12-01"),
      paymentDueDate: null, // §6.5 null paymentDueDate
      createdBy: adminUser.id,
    },
  });

  // 3. Supplier "NCC01 Test" with 2 PURCHASE orders
  let ncc01 = await prisma.party.findFirst({
    where: { businessUnitId: tkBU.id, name: "NCC01 Test" },
  });
  if (!ncc01) {
    ncc01 = await prisma.party.create({
      data: {
        businessUnitId: tkBU.id,
        name: "NCC01 Test",
        type: "SUPPLIER",
      },
    });
  }

  // NCC01 - Purchase order with "Mua vật tư" expense type
  const orderPurch001 = await prisma.order.upsert({
    where: {
      businessUnitId_partyId_orderNumber: {
        businessUnitId: tkBU.id,
        partyId: ncc01.id,
        orderNumber: "PO-001",
      },
    },
    update: {},
    create: {
      businessUnitId: tkBU.id,
      partyId: ncc01.id,
      orderNumber: "PO-001",
      type: "PURCHASE",
      status: "UNPAID",
      amountOriginal: 50_000_000,
      currencyId: vndCur.id,
      exchangeRate: 1,
      expenseTypeId: muaVatTu.id,
      orderDate: new Date("2026-04-01"),
      paymentDueDate: new Date("2026-05-15"),
      createdBy: adminUser.id,
    },
  });

  // NCC01 - Purchase order with "Chi phí tiện ích" expense type
  const orderPurch002 = await prisma.order.upsert({
    where: {
      businessUnitId_partyId_orderNumber: {
        businessUnitId: tkBU.id,
        partyId: ncc01.id,
        orderNumber: "PO-002",
      },
    },
    update: {},
    create: {
      businessUnitId: tkBU.id,
      partyId: ncc01.id,
      orderNumber: "PO-002",
      type: "PURCHASE",
      status: "UNPAID",
      amountOriginal: 10_000_000,
      currencyId: vndCur.id,
      exchangeRate: 1,
      expenseTypeId: chiphhh.id,
      orderDate: new Date("2026-04-05"),
      paymentDueDate: new Date("2026-05-20"),
      createdBy: adminUser.id,
    },
  });

  // 4. Standalone RECEIPT with bank fee — §6.7
  const receiptWithFee = await prisma.transaction.upsert({
    where: { id: "receipt-bankfee-001" },
    update: {},
    create: {
      id: "receipt-bankfee-001",
      orderId: null, // Standalone
      businessUnitId: tkBU.id,
      type: "RECEIPT",
      paymentMethod: "BANK",
      paymentType: "PAYMENT",
      amountOriginal: 10,
      currencyId: usdCur.id,
      amountVnd: 245_000, // 10 * 24.5k
      exchangeRate: 24.5,
      bankFeeOriginal: 0.5, // 0.5 USD fee
      bankFeeVnd: 12_250, // 0.5 * 24.5k
      bankReference: "NHH-RECEIPT-001",
      transactionDate: new Date("2026-04-18"),
      createdBy: adminUser.id,
    },
  });

  // 5. Standalone PAYMENT with expense category "Phí ngân hàng" — §6.7
  const paymentBankFee = await prisma.transaction.upsert({
    where: { id: "payment-bankfee-001" },
    update: {},
    create: {
      id: "payment-bankfee-001",
      orderId: null, // Standalone
      businessUnitId: tkBU.id,
      type: "PAYMENT",
      paymentMethod: "BANK",
      paymentType: "PAYMENT",
      amountOriginal: 1_250_000,
      currencyId: vndCur.id,
      amountVnd: 1_250_000,
      exchangeRate: 1,
      expenseTypeId: phiNganHang.id,
      bankReference: "NHH-BANKFEE-001",
      transactionDate: new Date("2026-04-19"),
      createdBy: adminUser.id,
    },
  });

  // 6. Deposits — §6.8
  // Customer deposit (20M USD)
  const depositCust = await prisma.deposit.upsert({
    where: { id: "deposit-cust-001" },
    update: {},
    create: {
      id: "deposit-cust-001",
      partyId: kh001.id,
      businessUnitId: tkBU.id,
      currencyId: usdCur.id,
      amountOriginal: 20,
      // Fully consumed by depositusage-001 (positive 20). Keep invariant: remaining = amount − Σpos.
      remainingOriginal: 0,
    },
  });

  // Supplier deposit (5M VND)
  const depositSupp = await prisma.deposit.upsert({
    where: { id: "deposit-supp-001" },
    update: {},
    create: {
      id: "deposit-supp-001",
      partyId: ncc01.id,
      businessUnitId: tkBU.id,
      currencyId: vndCur.id,
      amountOriginal: 5_000_000,
      remainingOriginal: 5_000_000,
    },
  });

  // 7. Order with paymentMethod=DEPOSIT linked via DepositUsage — §6.8
  const orderWithDeposit = await prisma.order.upsert({
    where: {
      businessUnitId_partyId_orderNumber: {
        businessUnitId: tkBU.id,
        partyId: kh001.id,
        orderNumber: "010-DEPOSIT",
      },
    },
    update: {},
    create: {
      businessUnitId: tkBU.id,
      partyId: kh001.id,
      orderNumber: "010-DEPOSIT",
      type: "SALE",
      status: "PAID",
      amountOriginal: 20,
      currencyId: usdCur.id,
      exchangeRate: 24.5,
      orderDate: new Date("2026-04-12"),
      paymentDueDate: new Date("2026-05-12"),
      createdBy: adminUser.id,
    },
  });

  // Payment via deposit usage (DEPOSIT method) on 010-DEPOSIT
  const depositPayment = await prisma.transaction.upsert({
    where: { id: "payment-deposit-001" },
    update: {},
    create: {
      id: "payment-deposit-001",
      orderId: orderWithDeposit.id,
      businessUnitId: tkBU.id,
      type: "SALE_PAYMENT",
      paymentMethod: "DEPOSIT",
      paymentType: "PAYMENT",
      amountOriginal: 20,
      currencyId: usdCur.id,
      amountVnd: 490_000, // 20 * 24.5k
      exchangeRate: 24.5,
      transactionDate: new Date("2026-04-13"),
      createdBy: adminUser.id,
    },
  });

  // Link deposit to payment via DepositUsage
  const depositUsage = await prisma.depositUsage.upsert({
    where: { id: "depositusage-001" },
    update: {},
    create: {
      id: "depositusage-001",
      depositId: depositCust.id,
      transactionId: depositPayment.id,
      amountOriginal: 20,
    },
  });

  console.log("\n✅ Seed completed successfully!\n");
  console.log("Created test data:");
  console.log(`  - Customer KH001 with 3 orders: 008-ND (USD, 0 payment), 009-TM (VND, fully paid), 001-TN (RMB, partial+adjustment)`);
  console.log(`  - Order 999-LEGACY (USD, exchangeRate=1, null paymentDueDate)`);
  console.log(`  - Supplier NCC01 with 2 purchase orders: PO-001 (Mua vật tư), PO-002 (Chi phí tiện ích)`);
  console.log(`  - Standalone RECEIPT with bank fee (10 USD + 0.5 USD fee)`);
  console.log(`  - Standalone PAYMENT with "Phí ngân hàng" category`);
  console.log(`  - 2 Deposits: customer (20 USD), supplier (5M VND)`);
  console.log(`  - Order 010-DEPOSIT with payment via DepositUsage`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

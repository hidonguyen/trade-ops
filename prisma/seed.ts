// Database seed: creates admin user, business units, currencies, expense types
// Prisma 7: must pass pg adapter since there is no Rust query engine
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Admin user
  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      passwordHash,
    },
  });

  // ADMIN role is global (null businessUnitId). Compound unique includes a
  // nullable column, so use findFirst+create rather than upsert.
  const adminRole = await prisma.userRoleAssignment.findFirst({
    where: { userId: admin.id, role: "ADMIN", businessUnitId: null },
  });
  if (!adminRole) {
    await prisma.userRoleAssignment.create({
      data: { userId: admin.id, role: "ADMIN", assignedBy: admin.id },
    });
  }

  // Business units
  const tk = await prisma.businessUnit.upsert({
    where: { code: "TK" },
    update: {},
    create: { code: "TK", name: "Trang Khanh" },
  });
  await prisma.businessUnit.upsert({
    where: { code: "NT" },
    update: {},
    create: { code: "NT", name: "Ngọc Trinh" },
  });

  // Example multi-BU user: ACCOUNTANT_SALE scoped to TK only (dev convenience).
  const saleUser = await prisma.user.upsert({
    where: { email: "sale.tk@example.com" },
    update: {},
    create: {
      email: "sale.tk@example.com",
      name: "Sale TK",
      passwordHash,
    },
  });
  const saleRole = await prisma.userRoleAssignment.findFirst({
    where: { userId: saleUser.id, role: "ACCOUNTANT_SALE", businessUnitId: tk.id },
  });
  if (!saleRole) {
    await prisma.userRoleAssignment.create({
      data: {
        userId: saleUser.id,
        role: "ACCOUNTANT_SALE",
        businessUnitId: tk.id,
        assignedBy: admin.id,
      },
    });
  }

  // Currencies
  await prisma.currency.upsert({
    where: { code: "VND" },
    update: {},
    create: { code: "VND", name: "Việt Nam Đồng", symbol: "₫" },
  });
  await prisma.currency.upsert({
    where: { code: "USD" },
    update: {},
    create: { code: "USD", name: "US Dollar", symbol: "$" },
  });
  await prisma.currency.upsert({
    where: { code: "RMB" },
    update: {},
    create: { code: "RMB", name: "Nhân Dân Tệ", symbol: "¥" },
  });

  // Expense types (no unique constraint — use findFirst+create pattern)
  const expenseTypeNames = [
    "Tiện ích",
    "Lương",
    "Thuê mặt bằng",
    "Vận chuyển",
    "Hải quan",
    "Khác",
    "Mua vật tư",
    "Chi phí tiện ích",
    "Chi phí khác",
    "Phí ngân hàng",
    "Cọc",
  ];
  for (const name of expenseTypeNames) {
    const existing = await prisma.expenseType.findFirst({ where: { name } });
    if (!existing) {
      await prisma.expenseType.create({ data: { name } });
    }
  }

  console.log("Seed completed successfully");
  console.log("Login: admin@example.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

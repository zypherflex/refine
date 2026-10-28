import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedHub } from "./seed-hub";
import { seedFxDemo, seedEveryday, seedRevenueDemo } from "./seed-everyday";

const db = new PrismaClient();
export const DEMO_PASSWORD = "RefineryLens-demo-2026";

async function main() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);

  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const org = await db.organization.create({ data: { name: "RefineryLens Team", plan: "TEAM" } });
  const mk = (email: string, name: string, role: any, plan: any = "FREE", organizationId?: string) => db.user.create({ data: { email, name, role, plan, passwordHash: hash, organizationId } });
  const admin = await mk("admin@refinerylens.test", "Ada Admin", "ADMIN", "TEAM", org.id);
  const hub = await seedHub(db, (email, name) => mk(email, name, "USER"), admin.id);
  await seedEveryday(db, (email, name) => mk(email, name, "USER"), { ikejaId: hub.ikeja.id, surulereId: hub.surulere.id });
  await seedRevenueDemo(db, (email, name) => mk(email, name, "USER"));
  await seedFxDemo(db);

  console.log("Seeded RefineryLens.");
  console.log(`  Admin (password ${DEMO_PASSWORD}): admin@refinerylens.test`);
  console.log("  Trade hub (same password): seller@, buyer@, haulier@, refinery@, converter@, cng@ refinerylens.test; nine demo businesses, ten listings, eleven gas sites, price reports, delivery jobs and supply agreements\n  Everyday (same password): tunde@ (household with a cylinder and orders), kemi@, emeka@, halima@, joy@ refinerylens.test; demo stations and reports\n  Data (same password): data@refinerylens.test (Professional data customer); price index built for 14 days; one demo sponsor");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

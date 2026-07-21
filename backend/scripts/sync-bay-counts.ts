/**
 * Ensure each branch has the expected bay counts:
 * البلدية = 4, المحمدية = 3, الفيصلية = 3
 * Does not delete bays that already have jobs; only adds missing ones.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGETS: { nameIncludes: string; count: number; prefix: string }[] = [
  { nameIncludes: "بلدية", count: 4, prefix: "موقف" },
  { nameIncludes: "محمدية", count: 3, prefix: "موقف" },
  { nameIncludes: "فيصلية", count: 3, prefix: "موقف" },
];

async function main() {
  const branches = await prisma.branch.findMany({ where: { isActive: true } });
  for (const target of TARGETS) {
    const branch = branches.find((b) => b.name.includes(target.nameIncludes));
    if (!branch) {
      console.log(`Branch matching "${target.nameIncludes}" not found — skip`);
      continue;
    }
    const existing = await prisma.bay.findMany({ where: { branchId: branch.id }, orderBy: { id: "asc" } });
    console.log(`${branch.name}: ${existing.length} bays (target ${target.count})`);
    for (let i = existing.length; i < target.count; i++) {
      const bayName = `${target.prefix} ${i + 1}`;
      const bay = await prisma.bay.create({
        data: { branchId: branch.id, bayName, bayType: "normal" },
      });
      console.log(`  + created ${bay.bayName} (#${bay.id})`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

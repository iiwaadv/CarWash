import { PrismaClient } from "@prisma/client";

// Serverless platforms (e.g. Vercel) can invoke this module many times across
// hot lambda instances; caching the client on `global` avoids exhausting the
// database's connection limit with a fresh client per invocation.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

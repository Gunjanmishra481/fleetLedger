import { PrismaClient } from "@prisma/client";

// One client per process; survives Next dev hot reloads.
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;

export type Db = PrismaClient;
/** Prisma client or an interactive-transaction client. */
export type DbTx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

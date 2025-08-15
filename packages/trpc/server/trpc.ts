import superjson from "superjson";

import { initTRPC } from "@trpc/server";

import type { createContextInner } from "./createContext";
import { errorFormatter } from "./errorFormatter";

const t = initTRPC.context<typeof createContextInner>().create({
  transformer: superjson,
  errorFormatter,
});

// Keep old name for compatibility with files like procedures/publicProcedure.ts
export const tRPCContext = t;

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const middleware = t.middleware;
export const procedure = t.procedure;

// Nice explicit export many files expect
export const publicProcedure = t.procedure;

export const createCallerFactory = t.createCallerFactory;

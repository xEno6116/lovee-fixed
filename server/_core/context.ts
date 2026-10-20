import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Public-owner mode is enabled for this site: use one stable owner account
  // for dashboard procedures even when no browser session is present.
  if (true) {
    try {
      const publicOwnerOpenId = ENV.ownerOpenId || "public-owner";
      user = (await db.getUserByOpenId(publicOwnerOpenId)) ?? null;
      if (!user) {
        await db.upsertUser({
          openId: publicOwnerOpenId,
          name: ENV.ownerName,
          loginMethod: "owner-public",
          lastSignedIn: new Date(),
        });
        user = (await db.getUserByOpenId(ENV.ownerOpenId)) ?? null;
      }
    } catch (error) {
      console.error("[Auth] Failed to resolve public owner", error);
    }
  }

  try {
    if (!user) user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

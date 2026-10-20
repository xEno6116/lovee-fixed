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

  // The owner explicitly opted out of password protection. In this mode the
  // configured owner account is used for all requests so the existing
  // dashboard and protected site procedures continue to work without a login
  // screen. This is intentionally tied to the absence of the password secret.
  if (!ENV.ownerLoginPassword && ENV.ownerOpenId) {
    try {
      user = (await db.getUserByOpenId(ENV.ownerOpenId)) ?? null;
      if (!user) {
        await db.upsertUser({
          openId: ENV.ownerOpenId,
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

import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const anniversarySites = mysqlTable("anniversary_sites", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  title: varchar("title", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  siteId: int("siteId").notNull().unique(),
  pinHash: varchar("pinHash", { length: 64 }).notNull(),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  memoryMessage: text("memoryMessage").notNull(),
  musicUrl: text("musicUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const mediaAssets = mysqlTable("media_assets", {
  id: int("id").autoincrement().primaryKey(),
  siteId: int("siteId").notNull(),
  kind: mysqlEnum("kind", ["image", "video", "audio"]).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: text("url").notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AnniversarySite = typeof anniversarySites.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;

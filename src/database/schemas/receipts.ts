import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  decimal,
  jsonb,
} from "drizzle-orm/pg-core";

import { users, events, eventShoppingLists } from "./schema.js";

export const receipts = pgTable("receipts", {
  id: varchar("id", { length: 36 })
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  eventId: varchar("event_id", { length: 36 }).references(() => events.id, {
    onDelete: "set null",
  }),

  shoppingListId: varchar("shopping_list_id", { length: 36 }).references(
    () => eventShoppingLists.id,
    { onDelete: "set null" },
  ),

  storeName: text("store_name"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  purchaseDate: timestamp("purchase_date", { withTimezone: true }),

  items: jsonb("items").default(sql`'[]'::jsonb`), // Array of { name, quantity, price }

  imageUrl: text("image_url"),
  rawText: text("raw_text"),

  // Annotation fields for context tagging
  description: text("description"),
  tags: jsonb("tags").default(sql`'[]'::jsonb`), // Array of string tags

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = typeof receipts.$inferInsert;

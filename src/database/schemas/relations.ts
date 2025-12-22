import { relations } from "drizzle-orm";
import { accounts, ingredients, members, pantryItems, sessions, userOtps, users } from "./schema.js";

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  session: many(sessions),
  member: one(members, {
    fields: [users.id],
    references: [members.userId],
  }),
  otps: many(userOtps),
}));

export const userOtpsRelations = relations(userOtps, ({ one }) => ({
  user: one(users, {
    fields: [userOtps.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ many, one }) => ({
  primaryAdmin: one(users, {
    fields: [accounts.primaryAdminId],
    references: [users.id],
  }),

  members: many(members),
}));

export const membersRelations = relations(members, ({ one }) => ({
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),

  account: one(accounts, {
    fields: [members.accountId],
    references: [accounts.id],
  }),
}));


export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  pantryItems: many(pantryItems),
}));


export const pantryItemsRelations = relations(pantryItems, ({ one }) => ({
  account: one(accounts, {
    fields: [pantryItems.accountId],
    references: [accounts.id],
  }),
  ingredient: one(ingredients, {
    fields: [pantryItems.ingredientId],
    references: [ingredients.id],
  }),
  addedBy: one(members, {
    fields: [pantryItems.addedBy],
    references: [members.id],
  }),
}));
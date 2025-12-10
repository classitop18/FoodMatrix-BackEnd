import { relations } from "drizzle-orm";
import { accounts, members, sessions, users } from "./schema.ts";



export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  session: many(sessions),
  member: one(members, {
    fields: [users.id],
    references: [members.userId],
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

export const membersRelations = relations(members, ({ one, many }) => ({
  account: one(accounts, {
    fields: [members.accountId],
    references: [accounts.id],
  }),
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),
}));

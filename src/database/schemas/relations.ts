import { relations } from "drizzle-orm";
import {
  accounts,
  budgetConfigs,
  budgetConfigVersions,
  dailyBudgets,
  dailyExpenses,
  ingredients,
  members,
  pantryItems,
  sessions,
  userOtps,
  users,
} from "./schema.js";

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
  budgetConfigs: many(budgetConfigs),
  dailyBudgets: many(dailyBudgets),
  dailyExpenses: many(dailyExpenses),
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

// ================== BUDGET TRACKING RELATIONS ==================

export const budgetConfigsRelations = relations(
  budgetConfigs,
  ({ one, many }) => ({
    account: one(accounts, {
      fields: [budgetConfigs.accountId],
      references: [accounts.id],
    }),
    versions: many(budgetConfigVersions),
    dailyBudgets: many(dailyBudgets),
  }),
);

export const budgetConfigVersionsRelations = relations(
  budgetConfigVersions,
  ({ one }) => ({
    budgetConfig: one(budgetConfigs, {
      fields: [budgetConfigVersions.budgetConfigId],
      references: [budgetConfigs.id],
    }),
    changedByUser: one(users, {
      fields: [budgetConfigVersions.changedBy],
      references: [users.id],
    }),
  }),
);

export const dailyBudgetsRelations = relations(
  dailyBudgets,
  ({ one, many }) => ({
    account: one(accounts, {
      fields: [dailyBudgets.accountId],
      references: [accounts.id],
    }),
    budgetConfig: one(budgetConfigs, {
      fields: [dailyBudgets.budgetConfigId],
      references: [budgetConfigs.id],
    }),
    expenses: many(dailyExpenses),
  }),
);

export const dailyExpensesRelations = relations(dailyExpenses, ({ one }) => ({
  account: one(accounts, {
    fields: [dailyExpenses.accountId],
    references: [accounts.id],
  }),
  dailyBudget: one(dailyBudgets, {
    fields: [dailyExpenses.dailyBudgetId],
    references: [dailyBudgets.id],
  }),
  updatedByUser: one(users, {
    fields: [dailyExpenses.updatedBy],
    references: [users.id],
  }),
}));

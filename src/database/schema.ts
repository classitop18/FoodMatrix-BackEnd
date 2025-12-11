import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  numeric,
  integer,
  uuid,
} from "drizzle-orm/pg-core";
import {
  accountTypeEnum,
  budgetAllocationEnum,
  rolesEnum,
  sexEnum,
} from "./enums.ts";

// ================== USERS TABLE ==================
export const users = pgTable("users", {
  id: varchar("id", { length: 36 })
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  email: text("email").notNull().unique(),
  username: text("username").unique(),
  password: text("password").notNull(),

  isVerified: boolean("is_verified").notNull().default(false),
  avatar: text("avatar"),
  isMfaEnabled: boolean("is_mfa_enabled").notNull().default(false),

  otp: text("otp"),
  otpExpiresAt: timestamp("otp_expires_at", { withTimezone: true }),

  firstName: text("first_name").notNull(),
  lastName: text("last_name"),

  phone: text("phone"),

  // Address
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  zipCode: varchar("zip_code", { length: 20 }),
  formattedAddress: text("formatted_address"),

  // Coordinates
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  placeId: text("place_id"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

// ================== SESSIONS TABLE ==================
export const sessions = pgTable("sessions", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  userAgent: text("user_agent"),
  ip: text("ip"),
  isValid: boolean("is_valid").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).default(
    sql`now()`,
  ),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).default(
    sql`now()`,
  ),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

// ================== ACCOUNTS TABLE ==================
export const accounts = pgTable("accounts", {
  id: varchar("id", { length: 36 })
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  accountNumber: varchar("account_number", { length: 8 }).notNull().unique(),

  accountName: text("account_name"),

  accountType: accountTypeEnum("account_type"),

  primaryAdminId: varchar("primary_admin_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Location
  zipCode: varchar("zip_code", { length: 10 }),
  city: text("city"),
  state: text("state"), // Allow full state names for international use

  // Budget tracking
  weeklyBudget: numeric("weekly_budget", { precision: 10, scale: 2 }).notNull(),
  dailyBudget: numeric("daily_budget", { precision: 10, scale: 2 }),
  monthlyBudget: numeric("monthly_budget", { precision: 10, scale: 2 }),
  annualBudget: numeric("annual_budget", { precision: 10, scale: 2 }),

  currentAllocation: budgetAllocationEnum("current_allocation")
    .notNull()
    .default("weekly"),

  groceriesPercentage: integer("groceries_percentage").default(70).notNull(),
  diningPercentage: integer("dining_percentage").default(20).notNull(),
  emergencyPercentage: integer("emergency_percentage").default(10).notNull(),

  currentWeekFoodSpending: numeric("current_week_food_spending", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),

  weeklyFoodStreak: integer("weekly_food_streak").default(0).notNull(),
  bestFoodStreak: integer("best_food_streak").default(0).notNull(),
  totalFoodOverrides: integer("total_food_overrides").default(0).notNull(),

  lastFoodBudgetReset: timestamp("last_food_budget_reset", {
    withTimezone: true,
  })
    .notNull()
    .default(sql`now()`),

  requiresAdminApprovalForOverrides: boolean(
    "requires_admin_approval_for_overrides",
  )
    .default(true)
    .notNull(),

  defaultPlanningPeriod: budgetAllocationEnum("default_planning_period")
    .notNull()
    .default("weekly"),

  autoGenerateGroceryLists: boolean("auto_generate_grocery_lists")
    .default(true)
    .notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ================== MEMBERS TABLE ==================
export const members = pgTable("members", {
  id: varchar("id", { length: 36 })
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  accountId: varchar("account_id", { length: 36 })
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),

  userId: varchar("user_id", { length: 36 }).references(() => users.id, {
    onDelete: "set null",
  }), // null => internal member

  role: rolesEnum("role").notNull().default("viewer"), // owner, super_admin, member, internal

  name: text("name"), // For internal members only
  age: integer("age"),
  sex: sexEnum("sex"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

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
  jsonb,
  decimal,
} from "drizzle-orm/pg-core";

import {
  accountTypeEnum,
  activityLevelEnum,
  allergyEnum,
  budgetAllocationEnum,
  budgetFlexibilityEnum,
  cookingFrequencyEnum,
  cookingSkillEnum,
  dietaryRestrictionEnum,
  healthConditionEnum,
  healthGoalEnum,
  organicPreferenceEnum,
  privacyLevelEnum,
  rolesEnum,
  sexEnum,
} from "./enums.js";

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

export const userOtps = pgTable("user_otps", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  otp: varchar("otp", { length: 6 }).notNull(),

  purpose: text("purpose").notNull(),
  // examples: 'LOGIN_MFA', 'EMAIL_VERIFY', 'PASSWORD_RESET'

  tempSessionToken: text("temp_session_token"),
  // JIT temp token for MFA flow (optional but recommended)

  createdAt: timestamp("created_at", { withTimezone: true }).default(
    sql`now()`,
  ),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  used: boolean("used").default(false),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// ================== ACCOUNTS TABLE ==================
export const accounts = pgTable("accounts", {
  id: varchar("id", { length: 36 })
    .default(sql`gen_random_uuid()`)
    .primaryKey(),

  accountNumber: varchar("account_number", { length: 8 }).notNull().unique(),
  accountName: text("account_name"),
  accountType: accountTypeEnum("account_type").default("family"),
  primaryAdminId: varchar("primary_admin_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  description: text("description"),

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

// Health profiles
export const healthProfiles = pgTable("health_profiles", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  memberId: varchar("member_id", { length: 36 })
    .notNull()
    .references(() => members.id),

  // Demographics & Physical Info
  height: decimal("height", { precision: 5, scale: 2 }), // in inches
  weight: decimal("weight", { precision: 5, scale: 2 }), // in pounds
  activityLevel: activityLevelEnum("activity_level"),

  // Medical Conditions & Health Issues
  conditions: healthConditionEnum("conditions")
    .array()
    .default(sql`'{}'::health_condition[]`),
  allergies: allergyEnum("allergies")
    .array()
    .default(sql`'{}'::allergy[]`),

  // Dietary Restrictions & Preferences
  dietaryRestrictions: dietaryRestrictionEnum("dietary_restrictions")
    .array()
    .default(sql`'{}'::dietary_restriction[]`),
  organicPreference:
    organicPreferenceEnum("organic_preference").default("standard_only"),

  // Health & Nutrition Goals
  goals: healthGoalEnum("goals")
    .array()
    .default(sql`'{}'::health_goal[]`),
  targetWeight: decimal("target_weight", { precision: 5, scale: 2 }), // in pounds

  // Food Behavior & Lifestyle
  cookingSkill: cookingSkillEnum("cooking_skill"),
  cookingFrequency: cookingFrequencyEnum("cooking_frequency"),
  preferredCuisines: text("preferred_cuisines")
    .array()
    .default(sql`'{}'::text[]`), // free text array
  budgetFlexibility: budgetFlexibilityEnum("budget_flexibility"),

  // Food Preferences (Exclude/Include)
  excludedFoods: text("excluded_foods")
    .array()
    .default(sql`'{}'::text[]`), // Foods to avoid from predefined lists
  includedFoods: text("included_foods")
    .array()
    .default(sql`'{}'::text[]`), // Foods to include more often
  customExclusions: text("custom_exclusions")
    .array()
    .default(sql`'{}'::text[]`), // User-defined exclusions
  customInclusions: text("custom_inclusions")
    .array()
    .default(sql`'{}'::text[]`), // User-defined inclusions
  preferenceSets: text("preference_sets")
    .array()
    .default(sql`'{}'::text[]`), // Preset combinations like 'no_dairy', 'halal_only', 'low_fodmap', 'nut_free'
  autoLearn: boolean("auto_learn").default(true), // Learn from meal feedback
  autoSwap: boolean("auto_swap").default(true), // Auto-swap excluded ingredients

  // Storage & Shopping
  hasDeepFreezer: boolean("has_deep_freezer").default(false),
  shopsDaily: boolean("shops_daily").default(false),

  // Health Optimization & Scoring
  privacyLevel: privacyLevelEnum("privacy_level").default("private").notNull(),
  healthScore: integer("health_score").default(50),
  bmi: decimal("bmi", { precision: 4, scale: 1 }),
  dailySodiumLimitMg: integer("daily_sodium_limit_mg").default(2300), // Default 2300mg, 1500mg for hypertension
  dailyCarbLimitG: integer("daily_carb_limit_g"), // For diabetes management
  dailyCalorieTarget: integer("daily_calorie_target"),
  dailyFiberTargetG: integer("daily_fiber_target_g").default(25),
  lastHealthAssessment: timestamp("last_health_assessment"),
  conditionSpecificMetrics: jsonb("condition_specific_metrics").default(
    sql`'{}'::jsonb`,
  ),
  wearableConnected: boolean("wearable_connected").default(false),
  wearableType: text("wearable_type"), // 'fitbit', 'apple_health', 'google_fit'
  updatedAt: timestamp("updated_at")
    .default(sql`now()`)
    .notNull(),
});

export const invitations = pgTable("invitations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  accountId: varchar("account_id")
    .notNull()
    .references(() => accounts.id),

  email: text("email").notNull(),

  role: text("role"), // assigned ONLY when admin approves
  invitedBy: varchar("invited_by")
    .notNull()
    .references(() => users.id),

  token: text("token").notNull().unique(),

  status: text("status").notNull().default("pending"),
  // pending | user_accepted | approved | rejected | expired

  expiresAt: timestamp("expires_at").notNull(),

  acceptedAt: timestamp("accepted_at"), // user accepted
  approvedAt: timestamp("approved_at"), // admin approved
  rejectedAt: timestamp("rejected_at"),

  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

export const ingredients = pgTable("ingredients", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  category: text("category").notNull(), // produce, dairy, meat, etc.
  averagePrice: varchar("average_price"),
  averageUnit: varchar("average_unit"),
  defaultMeasurementUnit: text("default_measurement_unit"), // tbsp, cup, piece, etc.
  isPerishable: boolean("is_perishable").default(true),
  shelfLifeDays: integer("shelf_life_days"),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

export const pantryItems = pgTable("pantry_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountId: varchar("account_id")
    .notNull()
    .references(() => accounts.id),
  ingredientId: varchar("ingredient_id")
    .notNull()
    .references(() => ingredients.id),
  quantity: decimal("quantity", { precision: 8, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  location: text("location").notNull(),
  expirationDate: timestamp("expiration_date"),
  costPaid: decimal("cost_paid", { precision: 8, scale: 2 }),
  addedBy: varchar("added_by").references(() => members.id),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`now()`)
    .notNull(),
});

// Pantry Alerts - for expiry and low stock notifications
export const pantryAlerts = pgTable("pantry_alerts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountId: varchar("account_id")
    .notNull()
    .references(() => accounts.id),
  pantryItemId: varchar("pantry_item_id").references(() => pantryItems.id, {
    onDelete: "cascade",
  }),
  alertType: text("alert_type").notNull(), // 'expiring_soon', 'expired', 'low_stock'
  message: text("message").notNull(),
  severity: text("severity").notNull().default("warning"), // 'info', 'warning', 'critical'
  isDismissed: boolean("is_dismissed").default(false).notNull(),
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

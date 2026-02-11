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
  time,
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
  mealTypeEnum,
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
  weeklyBudget: numeric("weekly_budget", { precision: 16, scale: 2 }).notNull(),
  dailyBudget: numeric("daily_budget", { precision: 16, scale: 2 }),
  monthlyBudget: numeric("monthly_budget", { precision: 16, scale: 2 }),
  annualBudget: numeric("annual_budget", { precision: 16, scale: 2 }),

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

  role: rolesEnum("role").notNull().default("member"), // super_admin(owner) , admin , member

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

// Meal plans
export const mealPlan = pgTable("meal_plan", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountId: varchar("account_id")
    .notNull()
    .references(() => accounts.id),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => members.id),
  mealDate: timestamp("meal_date").notNull(),
  mealType: mealTypeEnum("meal_type").notNull(), // breakfast, lunch, dinner, snack
  // recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  servings: integer("servings").default(1).notNull(),
  status: varchar("status").default("planned"), // planned, cooked, skipped
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

// Recipes
export const recipes = pgTable("recipes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").references(() => accounts.id), // null for public recipes
  name: text("name").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(), // Can store JSON array of instruction steps
  servings: integer("servings").default(1).notNull(),
  score: integer("score").default(0).notNull(),
  lastPreference: text("last_preference"),
  prepTimeMinutes: integer("prep_time_minutes").notNull(),
  cookTimeMinutes: integer("cook_time_minutes").notNull(),
  totalTimeMinutes: integer("total_time_minutes").notNull(),
  difficultyLevel: text("difficulty_level").notNull(),
  mealType: mealTypeEnum("meal_type").notNull(),
  cuisineType: text("cuisine_type").notNull(),
  estimatedCostPerServing: decimal("estimated_cost_per_serving", {
    precision: 8,
    scale: 2,
  }),
  calories: integer("calories"),
  isPublic: boolean("is_public").default(false),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`now()`)
    .notNull(),
  cookingStatus: text("cooking_status").default("not_cooked"), // cooked, not_cooked, not_interested
  imageUrl: text("image_url"),
  // AI Recipe Enhanced Fields - Store all AI-generated data
  // Nutrition Information (JSON object)
  nutrition: jsonb("nutrition"), // { calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, cholesterol_mg }
  // Cost Analysis (JSON object)
  costAnalysis: jsonb("cost_analysis"), // { totalCost, costPerServing, budgetEfficiency, pantryItemsSavings, shoppingCost }
  // Arrays for additional recipe information
  nutritionalHighlights: jsonb("nutritional_highlights"), // string[] - health benefits
  cookingTips: jsonb("cooking_tips"), // string[] - helpful cooking advice
  variations: jsonb("variations"), // string[] - recipe variations and substitutions
  healthConsiderations: jsonb("health_considerations"), // string[] - dietary considerations
  webSourceInspirations: jsonb("web_source_inspirations"), // string[] - source URLs or references
  // Health and Scoring
  healthScore: integer("health_score"), // 0-100 health rating
  budgetEfficiency: decimal("budget_efficiency", { precision: 5, scale: 2 }), // Percentage
  // AI Reasoning and Metadata
  aiReasoningNotes: text("ai_reasoning_notes"), // Why this recipe was suggested
  aiGeneratedMetadata: jsonb("ai_generated_metadata"), // Any additional AI metadata
  // Recipe Statistics
  timesCooked: integer("times_cooked").default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
  totalRatings: integer("total_ratings").default(0),
});

// Recipe ingredients (junction table)
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: varchar("ingredient_id")
    .notNull()
    .references(() => ingredients.id),
  quantity: varchar("quantity"),
  unit: varchar("unit"),
  isOptional: boolean("is_optional").default(false),
  notes: text("notes"), // e.g., "or substitute with..."

  // AI Recipe Enhanced Fields
  estimatedCost: decimal("estimated_cost", { precision: 8, scale: 2 }), // Cost for this ingredient in this recipe
  category: text("category"), // 'produce' | 'pantry' | 'dairy' | 'protein' | 'seafood' | 'meat' | 'bakery' | 'spices' | 'beverages' | 'frozen' | 'other'
  isPantryItem: boolean("is_pantry_item").default(false), // Whether this came from user's pantry
  substitutions: jsonb("substitutions"), // string[] - possible substitutions for this ingredient
  preparationNotes: text("preparation_notes"), // How to prepare this ingredient

  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`now()`)
    .notNull(),
});

export const userRecipeInteractions = pgTable("user_recipe_interactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recipeId: varchar("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  isLiked: boolean("is_liked").default(false),
  isDisliked: boolean("is_disliked").default(false),
  isFavorite: boolean("is_favorite").default(false),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`now()`)
    .notNull(),
});

// Recipe Shopping List Items
export const recipeShoppingListItems = pgTable("recipe_shopping_list_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),

  recipeIngredientId: varchar("recipe_ingredient_id").references(
    () => recipeIngredients.id,
    { onDelete: "set null" },
  ),

  ingredientName: text("ingredient_name").notNull(),
  quantity: varchar("quantity"),
  unit: varchar("unit"),

  isChecked: boolean("is_checked").default(false),

  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

// Event Planning module schemas

export const events = pgTable("events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountId: varchar("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  occasionType: text("occasion_type").notNull(), // birthday, anniversary, festival, gathering, housewarming, celebration, dinner_party, other
  eventDate: timestamp("event_date").notNull(),
  eventTime: time("event_time"),
  description: text("description"),
  status: text("status").default("draft").notNull(), // draft, planned, in_progress, completed, cancelled
  budgetType: text("budget_type").default("separate").notNull(), // separate, weekly
  budgetAmount: decimal("budget_amount", { precision: 16, scale: 2 }),
  adultGuests: integer("adult_guests").default(0).notNull(),
  kidGuests: integer("kid_guests").default(0).notNull(),
  selectedMealTypes: text("meals").array(), // breakfast, brunch, lunch, snacks, dinner, dessert, beverages
  guestNotes: text("guest_notes"),
  actualCost: decimal("actual_cost", { precision: 16, scale: 2 }),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => members.id),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`now()`)
    .notNull(),
});

export const eventBudget = pgTable("event_budget", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  totalBudget: decimal("total_budget", { precision: 16, scale: 2 }).notNull(),
  totalSpent: decimal("total_spent", { precision: 16, scale: 2 })
    .default("0")
    .notNull(),
  currency: text("currency").default("INR").notNull(),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

export const eventParticipants = pgTable("event_participants", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  memberId: varchar("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

export const eventExtraItems = pgTable("event_extra_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: decimal("quantity", { precision: 16, scale: 4 }).notNull(),
  unit: text("unit").notNull(),

  category: text("category"), // snacks | beverages
  estimatedCost: decimal("estimated_cost", { precision: 16, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 16, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

// Event Meals - for each meal type in an event
export const eventMeals = pgTable("event_meals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  mealType: text("meal_type").notNull(), // breakfast, brunch, lunch, snacks, dinner, dessert, beverages
  scheduledTime: time("scheduled_time"),
  estimatedCost: decimal("estimated_cost", { precision: 16, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 16, scale: 2 }),
  status: text("status").default("planned").notNull(), // planned, prepared, served, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

// Event Recipes - recipes added to each meal
export const eventRecipes = pgTable("event_recipes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventMealId: varchar("event_meal_id")
    .notNull()
    .references(() => eventMeals.id, { onDelete: "cascade" }),
  recipeId: varchar("recipe_id")
    .notNull()
    .references(() => recipes.id),
  servings: integer("servings").notNull(),
  scalingFactor: decimal("scaling_factor", { precision: 8, scale: 4 })
    .default("1")
    .notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 16, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

// Event Shopping Lists
export const eventShoppingLists = pgTable("event_shopping_lists", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  status: text("status").default("draft").notNull(), // draft, pending_approval, approved, purchased
  approvedBy: varchar("approved_by").references(() => members.id),
  approvedAt: timestamp("approved_at"),
  totalEstimated: decimal("total_estimated", { precision: 16, scale: 2 }),
  totalActual: decimal("total_actual", { precision: 16, scale: 2 }),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

// Event Shopping Items
export const eventShoppingItems = pgTable("event_shopping_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  shoppingListId: varchar("shopping_list_id")
    .notNull()
    .references(() => eventShoppingLists.id, { onDelete: "cascade" }),
  ingredientId: varchar("ingredient_id").references(() => ingredients.id),
  ingredientName: text("ingredient_name").notNull(),
  quantity: decimal("quantity", { precision: 16, scale: 4 }).notNull(),
  unit: text("unit").notNull(),
  estimatedPrice: decimal("estimated_price", { precision: 16, scale: 2 }),
  actualPrice: decimal("actual_price", { precision: 16, scale: 2 }),
  isPurchased: boolean("is_purchased").default(false).notNull(),
  category: text("category"),
  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
});

// Event Member Logs - for health tracking after event
export const eventMemberLogs = pgTable("event_member_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  memberId: varchar("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  consumedRecipeIds: text("consumed_recipe_ids")
    .array()
    .default(sql`'{}'::text[]`),
  caloriesConsumed: integer("calories_consumed"),
  nutritionData: jsonb("nutrition_data"),
  loggedAt: timestamp("logged_at")
    .default(sql`now()`)
    .notNull(),
});

// Event Generation State - stores snapshot of wizard state for future editing/reference
export const eventGenerationState = pgTable("event_generation_state", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),

  // JSON blob to store the entire wizard state
  // Includes: step, budgetStrategy, totalBudget, mealBudgets, mealRecipes, activeMealTab, globalCuisine, considerHealthProfile, selectedHealthMembers
  stateData: jsonb("state_data").notNull(),

  lastStep: varchar("last_step"), // helpful for quick resume

  createdAt: timestamp("created_at")
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`now()`)
    .notNull(),
});

// Export Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

export type Member = typeof members.$inferSelect;
export type InsertMember = typeof members.$inferInsert;

export type Ingredient = typeof ingredients.$inferSelect;
export type InsertIngredient = typeof ingredients.$inferInsert;

export type PantryItem = typeof pantryItems.$inferSelect;
export type InsertPantryItem = typeof pantryItems.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = typeof recipes.$inferInsert;

export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type InsertRecipeIngredient = typeof recipeIngredients.$inferInsert;

export type UserRecipeInteraction = typeof userRecipeInteractions.$inferSelect;
export type InsertUserRecipeInteraction =
  typeof userRecipeInteractions.$inferInsert;

export type RecipeShoppingListItem =
  typeof recipeShoppingListItems.$inferSelect;
export type InsertRecipeShoppingListItem =
  typeof recipeShoppingListItems.$inferInsert;

export type EventGenerationState = typeof eventGenerationState.$inferSelect;
export type InsertEventGenerationState =
  typeof eventGenerationState.$inferInsert;

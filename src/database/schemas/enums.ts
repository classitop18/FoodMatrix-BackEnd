import { pgEnum } from "drizzle-orm/pg-core";

// Enums
export const accountTypeEnum = pgEnum("account_type", [
  "individual",
  "family",
  "group",
]);
export const rolesEnum = pgEnum("role", ["admin", "super_admin", "member"]);
export const sexEnum = pgEnum("sex", ["male", "female", "other"]);
export const transactionCategoryEnum = pgEnum("transaction_category", [
  "groceries",
  "dining_out",
  "food_emergency",
  "non_food",
]);
export const foodCategoryEnum = pgEnum("food_category", [
  "groceries",
  "dining_out",
  "food_emergency",
]);

export const budgetAllocationEnum = pgEnum("budget_allocation", [
  "daily",
  "weekly",
  "monthly",
  "annual",
]);

// Receipt scanning enums
export const receiptStatusEnum = pgEnum("receipt_status", [
  "processing",
  "completed",
  "failed",
  "needs_review",
]);
export const itemCategoryEnum = pgEnum("item_category", [
  "food",
  "non_food",
  "uncertain",
]);

// Comprehensive health enums
export const activityLevelEnum = pgEnum("activity_level", [
  "sedentary",
  "moderate",
  "active",
  "very_active",
]);
export const healthConditionEnum = pgEnum("health_condition", [
  "type1_diabetes",
  "type2_diabetes",
  "prediabetes",
  "hypertension",
  "high_cholesterol",
  "heart_disease",
  "ibs",
  "gerd",
  "celiac_disease",
  "obesity",
  "pcos",
  "kidney_disease",
  "gout",
]);
export const allergyEnum = pgEnum("allergy", [
  "nuts",
  "dairy",
  "gluten",
  "shellfish",
  "soy",
  "eggs",
]);
export const dietaryRestrictionEnum = pgEnum("dietary_restriction", [
  "vegan",
  "vegetarian",
  "keto",
  "paleo",
  "mediterranean",
  "low_carb",
  "dash",
  "halal",
  "kosher",
]);
export const healthGoalEnum = pgEnum("health_goal", [
  "lose_weight",
  "maintain_weight",
  "gain_weight",
  "build_muscle",
  "control_blood_sugar",
  "lower_cholesterol",
  "reduce_sodium",
  "general_wellness",
  "healthy_family_eating",
]);
export const cookingSkillEnum = pgEnum("cooking_skill", [
  "beginner",
  "moderate",
  "advanced",
]);
export const cookingFrequencyEnum = pgEnum("cooking_frequency", [
  "rarely",
  "mostly_home",
  "mixed",
  "mostly_dining_out",
]);
export const budgetFlexibilityEnum = pgEnum("budget_flexibility", [
  "strict",
  "moderate",
  "flexible",
]);
export const privacyLevelEnum = pgEnum("privacy_level", [
  "private",
  "admin_only",
  "shared",
]);
export const organicPreferenceEnum = pgEnum("organic_preference", [
  "standard_only",
  "prefer_when_budget_allows",
  "organic_only",
]);

// Event & Party Planning enums
export const eventTypeEnum = pgEnum("event_type", [
  "birthday",
  "holiday",
  "dinner_party",
  "bbq",
  "potluck",
  "anniversary",
  "celebration",
  "other",
]);
export const budgetSourceEnum = pgEnum("budget_source", ["separate", "merged"]);
export const fulfillmentMethodEnum = pgEnum("fulfillment_method", [
  "cook",
  "catering",
  "group_dining",
  "potluck_coordination",
]);
export const guestCategoryEnum = pgEnum("guest_category", [
  "family_member",
  "party_guest",
]);

export const mealTypeEnum = pgEnum("meal_type", [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
]);

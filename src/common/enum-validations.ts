import { z } from "zod";

export const accountTypeEnum = z.enum(["individual","group", "family"]);

export const activityLevelEnum = z.enum([
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
]);

export const healthConditionEnum = z.enum([
  "type1_diabetes",
  "type2_diabetes",
  "high_cholesterol",
  "pcos",
  "obesity",
  "ibs",
  "celiac_disease",
]);

export const allergyEnum = z.enum(["soy", "dairy", "shellfish", "nuts"]);

export const dietaryRestrictionEnum = z.enum([
  "halal",
  "mediterranean",
  "vegetarian",
  "vegan",
  "dash",
]);

export const organicPreferenceEnum = z.enum([
  "standard_only",
  "prefer_when_budget_allows",
  "always_organic",
]);

export const healthGoalEnum = z.enum([
  "lose_weight",
  "gain_weight",
  "general_wellness",
  "lower_cholesterol",
]);

export const cookingSkillEnum = z.enum(["beginner", "moderate", "advanced"]);

export const cookingFrequencyEnum = z.enum([
  "rarely",
  "sometimes",
  "mostly_home",
  "daily",
]);

export const budgetFlexibilityEnum = z.enum(["strict", "moderate", "flexible"]);

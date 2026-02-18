import { z } from "zod";

// Event Status Enum
export const EventStatusEnum = z.enum([
  "draft",
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

// Occasion Type Enum
export const OccasionTypeEnum = z.enum([
  "birthday",
  "anniversary",
  "festival",
  "gathering",
  "housewarming",
  "celebration",
  "dinner_party",
  "other",
]);

// Budget Type Enum
export const BudgetTypeEnum = z.enum(["separate", "weekly"]);

// Meal Type Enum
export const MealTypeEnum = z.enum([
  "breakfast",
  "lunch",
  "snacks",
  "dinner",
  "dessert",
  "beverages",
]);

// Course Type Enum
export const CourseTypeEnum = z.enum([
  "starter",
  "main_course",
  "side_dish",
  "appetizer",
  "salad",
  "soup",
]);

// Meal Status Enum
export const MealStatusEnum = z.enum([
  "planned",
  "prepared",
  "served",
  "cancelled",
]);

// Shopping List Status Enum
export const ShoppingListStatusEnum = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "purchased",
]);

// Create Event DTO
export const createEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  occasionType: z.string().optional(),
  eventDate: z.string().or(z.date()),
  eventTime: z.string().optional(),
  description: z.string().optional(),
  budgetType: BudgetTypeEnum,
  budgetAmount: z.number().positive().optional(),
  currency: z.string().default("USD"),
  adultGuests: z.number().int().min(0).default(0),
  kidGuests: z.number().int().min(0).default(0),
  selectedMemberIds: z.array(z.string()).default([]),
  guestNotes: z.string().optional(),
  selectedMealTypes: z.array(MealTypeEnum).default([]),
});

export type CreateEventDto = z.infer<typeof createEventSchema>;

// Update Event DTO
export const updateEventSchema = z.object({
  name: z.string().min(1).optional(),
  occasionType: z.string().optional(),
  eventDate: z.string().or(z.date()).optional(),
  eventTime: z.string().optional(),
  description: z.string().optional(),
  status: EventStatusEnum.optional(),
  budgetType: BudgetTypeEnum.optional(),
  budgetAmount: z.number().positive().optional(),
  adultGuests: z.number().int().min(0).optional(),
  kidGuests: z.number().int().min(0).optional(),
  selectedMemberIds: z.array(z.string()).optional(),
  guestNotes: z.string().optional(),
  actualCost: z.number().optional(),
  allocations: z.record(z.string(), z.number()).optional(),
  currency: z.string().optional(),
});

export type UpdateEventDto = z.infer<typeof updateEventSchema>;

// Get Events Query DTO
export const getEventsQuerySchema = z.object({
  accountId: z.string(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z
    .enum(["eventDate", "name", "createdAt", "status"])
    .default("eventDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: EventStatusEnum.optional(),
  occasionType: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
});

export type GetEventsQueryDto = z.infer<typeof getEventsQuerySchema>;

// Create Event Meal DTO
export const createEventMealSchema = z.object({
  mealType: MealTypeEnum,
  scheduledTime: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateEventMealDto = z.infer<typeof createEventMealSchema>;

// Update Event Meal DTO
export const updateEventMealSchema = z.object({
  mealType: MealTypeEnum.optional(),
  scheduledTime: z.string().optional(),
  status: MealStatusEnum.optional(),
  estimatedCost: z.number().optional(),
  actualCost: z.number().optional(),
  notes: z.string().optional(),
});

export type UpdateEventMealDto = z.infer<typeof updateEventMealSchema>;

// Add Recipe to Meal DTO
export const addRecipeToMealSchema = z.object({
  recipeId: z.string(),

  servings: z.preprocess(
    (val) => (val !== undefined ? Math.round(Number(val)) : undefined),
    z.number().positive().optional(),
  ),

  notes: z.string().optional(),
});

export type AddRecipeToMealDto = z.infer<typeof addRecipeToMealSchema>;

// Generate Menu DTO
export const generateMenuSchema = z.object({
  mealTypes: z.array(MealTypeEnum),
  preferences: z
    .object({
      cuisineType: z.string().optional(),
      difficultyLevel: z.enum(["easy", "medium", "hard"]).optional(),
      maxPrepTime: z.number().int().positive().optional(),
      dietaryRestrictions: z.array(z.string()).optional(),
    })
    .optional(),
});

export type GenerateMenuDto = z.infer<typeof generateMenuSchema>;

// Shopping List Item DTO
export const shoppingListItemSchema = z.object({
  ingredientId: z.string().optional(),
  ingredientName: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  estimatedPrice: z.number().optional(),
  category: z.string().optional(),
});

export type ShoppingListItemDto = z.infer<typeof shoppingListItemSchema>;

// Create Shopping List DTO
export const createShoppingListSchema = z.object({
  items: z.array(shoppingListItemSchema).optional(),
});

export type CreateShoppingListDto = z.infer<typeof createShoppingListSchema>;

// Update Shopping List DTO
export const updateShoppingListSchema = z.object({
  status: ShoppingListStatusEnum.optional(),
  totalEstimated: z.number().optional(),
  totalActual: z.number().optional(),
  receiptUrl: z.string().optional(),
});

export type UpdateShoppingListDto = z.infer<typeof updateShoppingListSchema>;

// Log Member Consumption DTO
export const logMemberConsumptionSchema = z.object({
  memberId: z.string(),
  consumedRecipeIds: z.array(z.string()),
  notes: z.string().optional(),
});

export type LogMemberConsumptionDto = z.infer<
  typeof logMemberConsumptionSchema
>;

// Create Event Extra Item DTO
export const createEventExtraItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  category: z.string().optional(),
  estimatedCost: z.number().optional(),
  actualCost: z.number().optional(),
  notes: z.string().optional(),
});

export type CreateEventExtraItemDto = z.infer<
  typeof createEventExtraItemSchema
>;

// Bulk Create Event Extra Items DTO
export const createEventExtraItemsSchema = z.array(createEventExtraItemSchema);

export type CreateEventExtraItemsDto = z.infer<
  typeof createEventExtraItemsSchema
>;

// Update Event Extra Item DTO
export const updateEventExtraItemSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  category: z.string().optional(),
  estimatedCost: z.number().optional(),
  actualCost: z.number().optional(),
  notes: z.string().optional(),
});

export type UpdateEventExtraItemDto = z.infer<
  typeof updateEventExtraItemSchema
>;

// Response DTOs
export interface EventResponseDto {
  id: string;
  accountId: string;
  name: string;
  occasionType: string;
  eventDate: string;
  eventTime?: string;
  description?: string;
  status: string;
  budgetType: string;
  budgetAmount?: number;
  currency?: string;
  adultGuests: number;
  kidGuests: number;
  totalServings: number;
  actualCost?: number;
  guestNotes?: string;
  selectedMealTypes?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  meals?: EventMealResponseDto[];
  participants?: EventParticipantResponseDto[];
  budget?: EventBudgetResponseDto;
  shoppingList?: EventShoppingListResponseDto;
  extraItems?: EventExtraItemResponseDto[];
  costAnalysis?: CostAnalysisDto;
}

export interface EventMealResponseDto {
  id: string;
  eventId: string;
  mealType: string;
  scheduledTime?: string;
  estimatedCost?: number;
  actualCost?: number;
  status: string;
  createdAt: Date;
  recipes?: EventRecipeResponseDto[];
}

export interface EventRecipeResponseDto {
  id: string;
  eventMealId: string;
  recipeId: string;
  servings: number;
  scalingFactor: number;
  estimatedCost?: number;
  notes?: string;
  recipe?: any;
}

export interface EventExtraItemResponseDto {
  id: string;
  eventId: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  createdAt: Date;
}

export interface EventParticipantResponseDto {
  id: string;
  eventId: string;
  memberId: string;
  member?: any;
  createdAt: Date;
}

export interface EventBudgetResponseDto {
  id: string;
  eventId: string;
  totalBudget: number;
  totalSpent: number;
  allocations?: Record<string, number>;
  currency: string;
  createdAt: Date;
}

export interface EventShoppingListResponseDto {
  id: string;
  eventId: string;
  status: string;
  approvedBy?: string;
  approvedAt?: Date;
  totalEstimated?: number;
  totalActual?: number;
  receiptUrl?: string;
  createdAt: Date;
  items?: EventShoppingItemResponseDto[];
}

export interface EventShoppingItemResponseDto {
  id: string;
  shoppingListId: string;
  ingredientId?: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  actualPrice?: number;
  isPurchased: boolean;
  category?: string;
}

export interface CostAnalysisDto {
  totalEventCost: number;
  budgetAllocated?: number;
  budgetUtilized: number;
  remaining?: number;
  costPerAdult: number;
  costPerKid: number;
  costPerServing: number;
  status: "under_budget" | "on_track" | "over_budget";
}

export interface PaginatedEventsResponseDto {
  data: EventResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Budget Suggestion DTO
export const budgetSuggestionSchema = z.object({});

export type BudgetSuggestionDto = z.infer<typeof budgetSuggestionSchema>;

// Event Recipe Generation DTO
export const eventRecipeGenerationSchema = z.object({
  mealType: MealTypeEnum,
  courseType: CourseTypeEnum.optional(),
  recipeCount: z.number().int().min(1).max(10).optional().default(3),
  budget: z.number().positive().optional(),
  preferredCuisines: z.array(z.string()).optional(),
  customSearch: z.string().optional(),
  considerHealthProfiles: z.boolean().optional().default(true),
  targetMemberIds: z.array(z.string()).optional(),
  existingRecipeNames: z.array(z.string()).optional(),
});

export type EventRecipeGenerationDto = z.infer<
  typeof eventRecipeGenerationSchema
>;

// Budget Allocation Response DTO
export interface MealBudgetAllocationDto {
  mealType: string;
  suggestedBudget: number;
  percentage: number;
  reasoning: string;
}

export interface BudgetSuggestionResponseDto {
  eventId: string;
  eventName: string;
  totalBudget: number;
  currency: string;
  mealTypes: string[];
  allocations: MealBudgetAllocationDto[];
  aiRecommendations: string[];
  totalAllocated: number;
}

// Budget Tracking Response DTO
export interface MealBudgetTrackingDto {
  mealType: string;
  allocated: number;
  spent: number;
  remaining: number;
  recipeCount: number;
  utilizationPercent: number;
}

export interface BudgetTrackingResponseDto {
  eventId: string;
  eventName: string;
  totalBudget: number;
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  currency: string;
  utilizationPercent: number;
  status: "under_budget" | "on_track" | "over_budget";
  mealBreakdown: MealBudgetTrackingDto[];
}

// Event Types
export interface Event {
  id: string;
  accountId: string;
  name: string;
  occasionType: string;
  eventDate: Date;
  eventTime?: string;
  description?: string;
  status: EventStatus;
  budgetType: BudgetType;
  budgetAmount?: number;
  adultGuests: number;
  kidGuests: number;
  guestNotes?: string;
  actualCost?: number;
  selectedMealTypes?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EventStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type OccasionType =
  | "birthday"
  | "anniversary"
  | "festival"
  | "gathering"
  | "housewarming"
  | "celebration"
  | "dinner_party"
  | "other";

export type BudgetType = "separate" | "weekly";

export type MealType =
  | "breakfast"
  | "lunch"
  | "snacks"
  | "dinner"
  | "dessert"
  | "beverages";

export type MealStatus = "planned" | "prepared" | "served" | "cancelled";

export type ShoppingListStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "purchased";

// Event Extra Item
export interface EventExtraItem {
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

// Event with Relations
export interface EventWithRelations extends Event {
  meals?: EventMeal[];
  participants?: EventParticipant[];
  budget?: EventBudget;
  shoppingList?: EventShoppingList;
  extraItems?: EventExtraItem[];
  creator?: any;
}

// Event Meal
export interface EventMeal {
  id: string;
  eventId: string;
  mealType: MealType;
  scheduledTime?: string;
  estimatedCost?: number;
  actualCost?: number;
  status: MealStatus;
  createdAt: Date;
  recipes?: EventRecipe[];
}

// Event Recipe
export interface EventRecipe {
  id: string;
  eventMealId: string;
  recipeId: string;
  servings: number;
  scalingFactor: number;
  estimatedCost?: number;
  notes?: string;
  createdAt: Date;
  recipe?: any;
}

// Event Participant
export interface EventParticipant {
  id: string;
  eventId: string;
  memberId: string;
  createdAt: Date;
  member?: any;
}

// Event Budget
export interface EventBudget {
  id: string;
  eventId: string;
  totalBudget: number;
  totalSpent: number;
  allocations?: Record<string, number>;
  currency: string;
  createdAt: Date;
}

// Event Shopping List
export interface EventShoppingList {
  id: string;
  eventId: string;
  status: ShoppingListStatus;
  approvedBy?: string;
  approvedAt?: Date;
  totalEstimated?: number;
  totalActual?: number;
  receiptUrl?: string;
  createdAt: Date;
  items?: EventShoppingItem[];
}

// Event Shopping Item
export interface EventShoppingItem {
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
  createdAt: Date;
}

// Event Member Log (for health tracking)
export interface EventMemberLog {
  id: string;
  eventId: string;
  memberId: string;
  consumedRecipeIds: string[];
  caloriesConsumed?: number;
  nutritionData?: Record<string, any>;
  loggedAt: Date;
}

// Query Options
export interface EventQueryOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  accountId: string;
  status?: EventStatus;
  occasionType?: OccasionType;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

// Paginated Result
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Event Stats
export interface EventStats {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  cancelledEvents: number;
  totalSpent: number;
  averageCostPerEvent: number;
  averageCostPerGuest: number;
}

// Serving Multipliers
export const SERVING_MULTIPLIERS = {
  member: 1,
  adult: 1,
  kid: 0.5,
} as const;

// Custom Errors
export class EventNotFoundError extends Error {
  constructor(id: string) {
    super(`Event with id ${id} not found`);
    this.name = "EventNotFoundError";
  }
}

export class EventMealNotFoundError extends Error {
  constructor(id: string) {
    super(`Event meal with id ${id} not found`);
    this.name = "EventMealNotFoundError";
  }
}

export class UnauthorizedEventActionError extends Error {
  constructor(action: string) {
    super(`You are not authorized to ${action}`);
    this.name = "UnauthorizedEventActionError";
  }
}

export class InvalidEventDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEventDataError";
  }
}

export class EventBudgetExceededError extends Error {
  constructor(budgetAmount: number, requiredAmount: number) {
    super(`Event cost ${requiredAmount} exceeds budget ${budgetAmount}`);
    this.name = "EventBudgetExceededError";
  }
}

// Event Generation State
export interface EventGenerationState {
  id: string;
  eventId: string;
  stateData: any;
  lastStep?: string;
  createdAt: Date;
  updatedAt: Date;
}

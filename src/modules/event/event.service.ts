import {
  CreateEventDto,
  UpdateEventDto,
  CreateEventMealDto,
  UpdateEventMealDto,
  AddRecipeToMealDto,
  GenerateMenuDto,
  LogMemberConsumptionDto,
  EventResponseDto,
  EventMealResponseDto,
  PaginatedEventsResponseDto,
  CostAnalysisDto,
  GetEventsQueryDto,
  CreateEventExtraItemDto,
  UpdateEventExtraItemDto,
  EventExtraItemResponseDto,
  BudgetTrackingResponseDto,
  MealBudgetTrackingDto,
} from "./dto/event.dto.js";
import { IEventRepository, EventRepository } from "./event.repository.js";
import {
  EventWithRelations,
  EventNotFoundError,
  EventMealNotFoundError,
  UnauthorizedEventActionError,
  InvalidEventDataError,
  SERVING_MULTIPLIERS,
  EventStats,
  EventExtraItem,
} from "./types/event.types.js";
import {
  IMemberRepository,
  MemberRepository,
} from "../member/member.repository.js";
import {
  RecipeStorageInterface,
  RecipeStorage,
} from "../recipe/recipe.repository.js";
import { AIRecipeService } from "../ai/services/ai-recipe.service.js";
import { AIRecipeServiceFactory } from "../ai/ai-recipe-service.factory.js";
import { PantryItemsStorage } from "../pantry/pantry.repository.js";

export interface IEventService {
  // Event CRUD
  createEvent(
    data: CreateEventDto,
    accountId: string,
    requesterId: string,
  ): Promise<EventResponseDto>;
  getEventById(id: string, requesterId: string): Promise<EventResponseDto>;
  updateEvent(
    id: string,
    data: UpdateEventDto,
    requesterId: string,
  ): Promise<EventResponseDto>;
  deleteEvent(id: string, requesterId: string): Promise<void>;
  getEvents(
    query: GetEventsQueryDto,
    requesterId: string,
  ): Promise<PaginatedEventsResponseDto>;

  // Event Extra Items
  addExtraItem(
    eventId: string,
    data: CreateEventExtraItemDto,
    requesterId: string,
  ): Promise<EventExtraItemResponseDto>;
  addExtraItems(
    eventId: string,
    data: CreateEventExtraItemDto[],
    requesterId: string,
  ): Promise<EventExtraItemResponseDto[]>;
  updateExtraItem(
    eventId: string,
    itemId: string,
    data: UpdateEventExtraItemDto,
    requesterId: string,
  ): Promise<EventExtraItemResponseDto>;
  deleteExtraItem(
    eventId: string,
    itemId: string,
    requesterId: string,
  ): Promise<void>;
  getExtraItems(
    eventId: string,
    requesterId: string,
  ): Promise<EventExtraItemResponseDto[]>;

  // Event Meals
  addMealToEvent(
    eventId: string,
    data: CreateEventMealDto,
    requesterId: string,
  ): Promise<EventMealResponseDto>;
  updateEventMeal(
    eventId: string,
    mealId: string,
    data: UpdateEventMealDto,
    requesterId: string,
  ): Promise<EventMealResponseDto>;
  deleteEventMeal(
    eventId: string,
    mealId: string,
    requesterId: string,
  ): Promise<void>;
  getEventMeals(
    eventId: string,
    requesterId: string,
  ): Promise<EventMealResponseDto[]>;

  // Event Recipes
  addRecipeToMeal(
    eventId: string,
    mealId: string,
    data: AddRecipeToMealDto,
    requesterId: string,
  ): Promise<any>;
  removeRecipeFromMeal(
    eventId: string,
    mealId: string,
    recipeId: string,
    requesterId: string,
  ): Promise<void>;

  // Menu Generation
  generateMenu(
    eventId: string,
    data: GenerateMenuDto,
    requesterId: string,
  ): Promise<EventMealResponseDto[]>;

  // Shopping List
  generateShoppingList(eventId: string, requesterId: string): Promise<any>;
  getEventShoppingList(eventId: string, requesterId: string): Promise<any>;
  approveShoppingList(eventId: string, requesterId: string): Promise<any>;
  uploadReceipt(
    eventId: string,
    receiptUrl: string,
    requesterId: string,
  ): Promise<any>;

  // Event Completion
  completeEvent(
    eventId: string,
    requesterId: string,
  ): Promise<EventResponseDto>;
  logMemberConsumption(
    eventId: string,
    data: LogMemberConsumptionDto,
    requesterId: string,
  ): Promise<void>;

  // Analytics
  getEventAnalytics(
    eventId: string,
    requesterId: string,
  ): Promise<CostAnalysisDto>;
  getAccountEventStats(
    accountId: string,
    requesterId: string,
  ): Promise<EventStats>;

  // Budget Tracking
  getBudgetTracking(
    eventId: string,
    requesterId: string,
  ): Promise<BudgetTrackingResponseDto>;

  // Event Generation State
  getGenerationState(eventId: string, requesterId: string): Promise<any>;
  saveGenerationState(
    eventId: string,
    stateData: any,
    requesterId: string,
    lastStep?: string,
  ): Promise<void>;
}

export class EventService implements IEventService {
  constructor(
    private readonly eventRepo: IEventRepository = new EventRepository(),
    private readonly memberRepo: IMemberRepository = new MemberRepository(),
    private readonly recipeRepo: RecipeStorageInterface = new RecipeStorage(),
  ) {}

  private aiRecipeService: AIRecipeService | null = null;

  private getAIService(): AIRecipeService {
    if (!this.aiRecipeService) {
      this.aiRecipeService = AIRecipeServiceFactory.create("openai", {
        pantryStorage: new PantryItemsStorage(),
        recipeStorage: this.recipeRepo as RecipeStorage,
      });
    }
    return this.aiRecipeService;
  }

  // Calculate total servings for an event
  private calculateTotalServings(
    memberCount: number,
    adultGuests: number,
    kidGuests: number,
  ): number {
    return (
      memberCount * SERVING_MULTIPLIERS.member +
      adultGuests * SERVING_MULTIPLIERS.adult +
      kidGuests * SERVING_MULTIPLIERS.kid
    );
  }

  // Validate user access to account
  private async validateAccountAccess(
    requesterId: string,
    accountId: string,
    action: string,
  ): Promise<void> {
    const hasAccess = await this.memberRepo.isUserMember(
      requesterId,
      accountId,
    );
    if (!hasAccess) {
      throw new UnauthorizedEventActionError(action);
    }
  }

  // Validate admin access
  private async validateAdminAccess(
    requesterId: string,
    accountId: string,
    action: string,
  ): Promise<void> {
    const members = await this.memberRepo.findByUserId(requesterId, accountId);
    if (members.length === 0) {
      throw new UnauthorizedEventActionError(action);
    }

    const role = members[0].role;
    if (!["super_admin", "admin"].includes(role)) {
      throw new UnauthorizedEventActionError(action);
    }
  }

  // Get member ID for requester
  private async getMemberIdForRequester(
    requesterId: string,
    accountId: string,
  ): Promise<string> {
    const members = await this.memberRepo.findByUserId(requesterId, accountId);
    if (members.length === 0) {
      throw new UnauthorizedEventActionError("access this account");
    }
    return members[0].id;
  }

  // Map event to response DTO
  private mapToResponseDto(event: EventWithRelations): EventResponseDto {
    const participantCount = event.participants?.length || 0;
    const totalServings = this.calculateTotalServings(
      participantCount,
      event.adultGuests || 0,
      event.kidGuests || 0,
    );

    return {
      ...event,
      id: event.id,
      accountId: event.accountId,
      name: event.name,
      occasionType: event.occasionType,
      eventDate:
        event.eventDate instanceof Date
          ? event.eventDate.toISOString()
          : event.eventDate,
      eventTime: event.eventTime || undefined,
      description: event.description || undefined,
      status: event.status,
      budgetType: event.budgetType,
      budgetAmount: event.budgetAmount
        ? parseFloat(event.budgetAmount as any)
        : undefined,
      adultGuests: event.adultGuests || 0,
      kidGuests: event.kidGuests || 0,
      totalServings,
      actualCost: event.actualCost
        ? parseFloat(event.actualCost as any)
        : undefined,
      guestNotes: event.guestNotes || undefined,
      selectedMealTypes: event?.selectedMealTypes || [],
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      meals: event.meals?.map((meal: any) => ({
        id: meal.id,
        eventId: meal.eventId,
        mealType: meal.mealType,
        scheduledTime: meal.scheduledTime || undefined,
        estimatedCost: meal.estimatedCost
          ? parseFloat(meal.estimatedCost)
          : undefined,
        actualCost: meal.actualCost ? parseFloat(meal.actualCost) : undefined,
        status: meal.status,
        createdAt: meal.createdAt,
        recipes: meal.recipes || [],
      })),
      participants: event.participants?.map((p: any) => ({
        id: p.id,
        eventId: p.eventId,
        memberId: p.memberId,
        member: p.member,
        createdAt: p.createdAt,
      })),
      budget: event.budget
        ? {
            id: event.budget.id,
            eventId: event.budget.eventId,
            totalBudget: parseFloat(event.budget.totalBudget as any),
            totalSpent: parseFloat(event.budget.totalSpent as any),
            allocations: event.budget.allocations as
              | Record<string, number>
              | undefined,
            currency: event.budget.currency,
            createdAt: event.budget.createdAt,
          }
        : undefined,
      shoppingList: event.shoppingList
        ? {
            id: event.shoppingList.id,
            eventId: event.shoppingList.eventId,
            status: event.shoppingList.status,
            approvedBy: event.shoppingList.approvedBy || undefined,
            approvedAt: event.shoppingList.approvedAt || undefined,
            totalEstimated: event.shoppingList.totalEstimated
              ? parseFloat(event.shoppingList.totalEstimated as any)
              : undefined,
            totalActual: event.shoppingList.totalActual
              ? parseFloat(event.shoppingList.totalActual as any)
              : undefined,
            receiptUrl: event.shoppingList.receiptUrl || undefined,
            createdAt: event.shoppingList.createdAt,
            items: event.shoppingList.items?.map((item: any) => ({
              id: item.id,
              shoppingListId: item.shoppingListId,
              ingredientId: item.ingredientId || undefined,
              ingredientName: item.ingredientName,
              quantity: parseFloat(item.quantity),
              unit: item.unit,
              estimatedPrice: item.estimatedPrice
                ? parseFloat(item.estimatedPrice)
                : undefined,
              actualPrice: item.actualPrice
                ? parseFloat(item.actualPrice)
                : undefined,
              isPurchased: item.isPurchased,
              category: item.category || undefined,
            })),
          }
        : undefined,
      extraItems: event.extraItems?.map((item) => this.mapExtraItemToDto(item)),
    };
  }

  private mapExtraItemToDto(item: EventExtraItem): EventExtraItemResponseDto {
    return {
      id: item.id,
      eventId: item.eventId,
      name: item.name,
      quantity: parseFloat(item.quantity as any),
      unit: item.unit,
      category: item.category || undefined,
      estimatedCost: item.estimatedCost
        ? parseFloat(item.estimatedCost as any)
        : undefined,
      actualCost: item.actualCost
        ? parseFloat(item.actualCost as any)
        : undefined,
      notes: item.notes || undefined,
      createdAt: item.createdAt,
    };
  }

  // Event CRUD
  async createEvent(
    data: CreateEventDto,
    accountId: string,
    requesterId: string,
  ): Promise<EventResponseDto> {
    // Validate admin access
    await this.validateAdminAccess(requesterId, accountId, "create events");

    // Get member ID
    const memberId = await this.getMemberIdForRequester(requesterId, accountId);

    // Create the event
    const event = await this.eventRepo.create(data, accountId, memberId);

    // Get full event with relations
    const fullEvent = await this.eventRepo.findById(event.id, true);
    if (!fullEvent) {
      throw new EventNotFoundError(event.id);
    }

    return this.mapToResponseDto(fullEvent);
  }

  async getEventById(
    id: string,
    requesterId: string,
  ): Promise<EventResponseDto> {
    const event = await this.eventRepo.findById(id, true);
    if (!event) {
      throw new EventNotFoundError(id);
    }

    // Validate access
    await this.validateAccountAccess(
      requesterId,
      event.accountId,
      "view events",
    );

    return this.mapToResponseDto(event);
  }

  async updateEvent(
    id: string,
    data: UpdateEventDto,
    requesterId: string,
  ): Promise<EventResponseDto> {
    const event = await this.eventRepo.findById(id, false);
    if (!event) {
      throw new EventNotFoundError(id);
    }

    // Validate admin access
    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "update events",
    );

    // Update the event
    await this.eventRepo.update(id, data);

    // Get updated event
    const updatedEvent = await this.eventRepo.findById(id, true);
    if (!updatedEvent) {
      throw new EventNotFoundError(id);
    }

    return this.mapToResponseDto(updatedEvent);
  }

  async deleteEvent(id: string, requesterId: string): Promise<void> {
    const event = await this.eventRepo.findById(id, false);
    if (!event) {
      throw new EventNotFoundError(id);
    }

    // Validate admin access
    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "delete events",
    );

    await this.eventRepo.delete(id);
  }

  async getEvents(
    query: GetEventsQueryDto,
    requesterId: string,
  ): Promise<PaginatedEventsResponseDto> {
    // Validate access
    await this.validateAccountAccess(
      requesterId,
      query.accountId,
      "view events",
    );

    const result = await this.eventRepo.findAll({
      ...query,
      page: query.page || 1,
      limit: query.limit || 10,
      sortBy: query.sortBy || "eventDate",
      sortOrder: query.sortOrder || "desc",
    });

    return {
      data: result.data.map((event) => this.mapToResponseDto(event)),
      pagination: result.pagination,
    };
  }

  // Event Meals
  async addMealToEvent(
    eventId: string,
    data: CreateEventMealDto,
    requesterId: string,
  ): Promise<EventMealResponseDto> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "add meals to events",
    );

    const meal = await this.eventRepo.createMeal(eventId, data);

    return {
      id: meal.id,
      eventId: meal.eventId,
      mealType: meal.mealType,
      scheduledTime: meal.scheduledTime || undefined,
      status: meal.status,
      createdAt: meal.createdAt,
      recipes: [],
    };
  }

  async updateEventMeal(
    eventId: string,
    mealId: string,
    data: UpdateEventMealDto,
    requesterId: string,
  ): Promise<EventMealResponseDto> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const meal = await this.eventRepo.getMealById(mealId);
    if (!meal || meal.eventId !== eventId) {
      throw new EventMealNotFoundError(mealId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "update event meals",
    );

    const updatedMeal = await this.eventRepo.updateMeal(mealId, data);

    return {
      id: updatedMeal.id,
      eventId: updatedMeal.eventId,
      mealType: updatedMeal.mealType,
      scheduledTime: updatedMeal.scheduledTime || undefined,
      estimatedCost: updatedMeal.estimatedCost
        ? parseFloat(updatedMeal.estimatedCost as any)
        : undefined,
      actualCost: updatedMeal.actualCost
        ? parseFloat(updatedMeal.actualCost as any)
        : undefined,
      status: updatedMeal.status,
      createdAt: updatedMeal.createdAt,
    };
  }

  async deleteEventMeal(
    eventId: string,
    mealId: string,
    requesterId: string,
  ): Promise<void> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const meal = await this.eventRepo.getMealById(mealId);
    if (!meal || meal.eventId !== eventId) {
      throw new EventMealNotFoundError(mealId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "delete event meals",
    );

    await this.eventRepo.deleteMeal(mealId);
  }

  async getEventMeals(
    eventId: string,
    requesterId: string,
  ): Promise<EventMealResponseDto[]> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAccountAccess(
      requesterId,
      event.accountId,
      "view event meals",
    );

    const meals = await this.eventRepo.getMealsByEventId(eventId);

    return meals.map((meal: any) => ({
      id: meal.id,
      eventId: meal.eventId,
      mealType: meal.mealType,
      scheduledTime: meal.scheduledTime || undefined,
      estimatedCost: meal.estimatedCost
        ? parseFloat(meal.estimatedCost)
        : undefined,
      actualCost: meal.actualCost ? parseFloat(meal.actualCost) : undefined,
      status: meal.status,
      createdAt: meal.createdAt,
      recipes: meal.recipes || [],
    }));
  }

  // Event Recipes
  async addRecipeToMeal(
    eventId: string,
    mealId: string,
    data: AddRecipeToMealDto,
    requesterId: string,
  ): Promise<any> {
    const event = await this.eventRepo.findById(eventId, true);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const meal = await this.eventRepo.getMealById(mealId);
    if (!meal || meal.eventId !== eventId) {
      throw new EventMealNotFoundError(mealId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "add recipes to events",
    );

    // Calculate scaling factor based on event participants
    const participantCount = event.participants?.length || 0;
    const totalServings = this.calculateTotalServings(
      participantCount,
      event.adultGuests || 0,
      event.kidGuests || 0,
    );

    // Scaling factor = total servings needed / base recipe servings
    const scalingFactor = data.servings
      ? totalServings / data.servings
      : totalServings / 4;

    const eventRecipe = await this.eventRepo.addRecipeToMeal(
      mealId,
      data,
      scalingFactor,
    );

    return eventRecipe;
  }

  async removeRecipeFromMeal(
    eventId: string,
    mealId: string,
    recipeId: string,
    requesterId: string,
  ): Promise<void> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "remove recipes from events",
    );

    await this.eventRepo.removeRecipeFromMeal(recipeId);
  }

  // Menu Generation (placeholder - would integrate with AI service)
  async generateMenu(
    eventId: string,
    data: GenerateMenuDto,
    requesterId: string,
  ): Promise<EventMealResponseDto[]> {
    const event = await this.eventRepo.findById(eventId, true);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "generate menus",
    );

    // Create meals for each meal type
    const createdMeals: EventMealResponseDto[] = [];

    for (const mealType of data.mealTypes) {
      const meal = await this.eventRepo.createMeal(eventId, {
        mealType,
        notes: `Auto-generated ${mealType} for ${event.occasionType}`,
      });

      createdMeals.push({
        id: meal.id,
        eventId: meal.eventId,
        mealType: meal.mealType,
        status: meal.status,
        createdAt: meal.createdAt,
        recipes: [],
      });
    }

    // TODO: Integrate with AI service to suggest recipes based on:
    // - Occasion type
    // - Budget
    // - Guest preferences
    // - Dietary restrictions

    return createdMeals;
  }

  // Shopping List
  async generateShoppingList(
    eventId: string,
    requesterId: string,
  ): Promise<any> {
    const event = await this.eventRepo.findById(eventId, true);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "generate shopping lists",
    );

    // Check if shopping list already exists
    let shoppingList = await this.eventRepo.getShoppingListByEventId(eventId);

    if (!shoppingList) {
      shoppingList = await this.eventRepo.createShoppingList(eventId);
    } else {
      // Clear existing items to regenerate
      await this.eventRepo.clearShoppingListItems(shoppingList.id);
    }

    // 1. Map to hold merged items
    // Key: name::unit
    const mergedItems = new Map<
      string,
      {
        ingredientName: string;
        quantity: number;
        unit: string;
        estimatedPrice: number;
        category: string;
      }
    >();

    const normalizeKey = (name: string, unit: string) =>
      `${name.trim().toLowerCase()}::${unit.trim().toLowerCase()}`;

    // 2. Aggregate ingredients from all event recipes
    const meals = await this.eventRepo.getMealsByEventId(eventId);

    for (const meal of meals) {
      const recipes = await this.eventRepo.getRecipesByMealId(meal.id);

      for (const eventRecipe of recipes) {
        // Get full ingredient details from recipe repository
        const recipeIngredients = await this.recipeRepo.getRecipeIngredients(
          eventRecipe.recipeId,
        );

        const scalingFactor = parseFloat(eventRecipe.scalingFactor as any) || 1;

        for (const ing of recipeIngredients) {
          if (!ing.ingredient || !ing.ingredient.name) continue;

          const key = normalizeKey(ing.ingredient.name, ing.unit || "unit");
          const quantity =
            (parseFloat(ing.quantity as any) || 0) * scalingFactor;
          const estimatedCost =
            (parseFloat(ing.estimatedCost as any) || 0) * scalingFactor;

          if (mergedItems.has(key)) {
            const existing = mergedItems.get(key)!;
            existing.quantity += quantity;
            existing.estimatedPrice += estimatedCost;
            // distinct categories? Keep first one usually
          } else {
            mergedItems.set(key, {
              ingredientName: ing.ingredient.name,
              quantity,
              unit: ing.unit || "unit",
              estimatedPrice: estimatedCost,
              category: ing.category || "pantry",
            });
          }
        }
      }
    }

    // 3. Aggregate extra items (manual additions)
    const extraItems = await this.eventRepo.getExtraItemsByEventId(eventId);

    // AI Cost Estimation for Extra Items
    const itemsToEstimate: { name: string; quantity: number; unit: string }[] =
      [];
    for (const item of extraItems) {
      if (
        (!item.estimatedCost || parseFloat(item.estimatedCost as any) === 0) &&
        item.name
      ) {
        itemsToEstimate.push({
          name: item.name,
          quantity: parseFloat(item.quantity as any) || 1,
          unit: item.unit || "unit",
        });
      }
    }

    console.log(
      "Items to Estimate Costs:",
      JSON.stringify(itemsToEstimate, null, 2),
    );

    let estimatedCosts: Record<string, number> = {};
    if (itemsToEstimate.length > 0) {
      try {
        const aiService = this.getAIService();
        estimatedCosts =
          await aiService.estimateIngredientCosts(itemsToEstimate);
        console.log(
          "AI Estimated Costs Result:",
          JSON.stringify(estimatedCosts, null, 2),
        );
      } catch (e) {
        console.error("Failed to estimate costs for extra items", e);
      }
    }

    for (const item of extraItems) {
      if (!item.name) continue;

      const key = normalizeKey(item.name, item.unit || "unit");
      const quantity = parseFloat(item.quantity as any) || 0;
      let estimatedCost = parseFloat(item.estimatedCost as any) || 0;

      // Use AI estimate if explicit cost is missing
      if (estimatedCost === 0 && estimatedCosts[item.name.toLowerCase()]) {
        estimatedCost = estimatedCosts[item.name.toLowerCase()];
        console.log(`Applying AI cost for ${item.name}: ${estimatedCost}`);
      } else if (estimatedCost === 0) {
        console.log(
          `No AI cost found for ${item.name} (Key: ${item.name.toLowerCase()})`,
        );
      }

      if (mergedItems.has(key)) {
        const existing = mergedItems.get(key)!;
        existing.quantity += quantity;
        existing.estimatedPrice += estimatedCost;
      } else {
        mergedItems.set(key, {
          ingredientName: item.name,
          quantity,
          unit: item.unit || "unit",
          estimatedPrice: estimatedCost,
          category: item.category || "others",
        });
      }
    }

    // 4. Save to database
    for (const item of mergedItems.values()) {
      await this.eventRepo.addShoppingItem(shoppingList.id, {
        ingredientName: item.ingredientName,
        quantity: item.quantity, // Will be stringified in repo
        unit: item.unit,
        estimatedPrice: item.estimatedPrice,
        category: item.category,
        isPurchased: false,
      });
    }

    // Return updated list
    return await this.eventRepo.getShoppingListByEventId(eventId);
  }

  async getEventShoppingList(
    eventId: string,
    requesterId: string,
  ): Promise<any> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAccountAccess(
      requesterId,
      event.accountId,
      "view shopping lists",
    );

    return await this.eventRepo.getShoppingListByEventId(eventId);
  }

  async approveShoppingList(
    eventId: string,
    requesterId: string,
  ): Promise<any> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "approve shopping lists",
    );

    const shoppingList = await this.eventRepo.getShoppingListByEventId(eventId);
    if (!shoppingList) {
      throw new InvalidEventDataError("Shopping list not found");
    }

    await this.getMemberIdForRequester(requesterId, event.accountId);

    return await this.eventRepo.updateShoppingList(shoppingList.id, {
      status: "approved",
    });
  }

  async uploadReceipt(
    eventId: string,
    receiptUrl: string,
    requesterId: string,
  ): Promise<any> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAccountAccess(
      requesterId,
      event.accountId,
      "upload receipts",
    );

    const shoppingList = await this.eventRepo.getShoppingListByEventId(eventId);
    if (!shoppingList) {
      throw new InvalidEventDataError("Shopping list not found");
    }

    return await this.eventRepo.updateShoppingList(shoppingList.id, {
      receiptUrl,
      status: "purchased",
    });
  }

  // Event Completion
  async completeEvent(
    eventId: string,
    requesterId: string,
  ): Promise<EventResponseDto> {
    const event = await this.eventRepo.findById(eventId, true);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "complete events",
    );

    // Calculate actual cost from shopping list
    let actualCost = 0;
    if (event.shoppingList?.items) {
      actualCost = event.shoppingList.items.reduce((sum: number, item: any) => {
        return sum + (item.actualPrice ? parseFloat(item.actualPrice) : 0);
      }, 0);
    }

    await this.eventRepo.update(eventId, {
      status: "completed",
      actualCost,
    });

    const completedEvent = await this.eventRepo.findById(eventId, true);
    return this.mapToResponseDto(completedEvent!);
  }

  async logMemberConsumption(
    eventId: string,
    data: LogMemberConsumptionDto,
    requesterId: string,
  ): Promise<void> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAccountAccess(
      requesterId,
      event.accountId,
      "log consumption",
    );

    await this.eventRepo.logMemberConsumption(eventId, data);
  }

  // Analytics
  async getEventAnalytics(
    eventId: string,
    requesterId: string,
  ): Promise<CostAnalysisDto> {
    const event = await this.eventRepo.findById(eventId, true);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAccountAccess(
      requesterId,
      event.accountId,
      "view analytics",
    );

    const participantCount = event.participants?.length || 0;
    const totalServings = this.calculateTotalServings(
      participantCount,
      event.adultGuests || 0,
      event.kidGuests || 0,
    );

    const budgetAllocated = event.budget
      ? parseFloat(event.budget.totalBudget as any)
      : event.budgetAmount
        ? parseFloat(event.budgetAmount as any)
        : 0;

    const totalSpent = event.actualCost
      ? parseFloat(event.actualCost as any)
      : 0;
    const budgetUtilized =
      budgetAllocated > 0 ? (totalSpent / budgetAllocated) * 100 : 0;

    const totalGuests =
      (event.adultGuests || 0) + (event.kidGuests || 0) + participantCount;
    const costPerAdult = totalGuests > 0 ? totalSpent / totalServings : 0;
    const costPerKid = costPerAdult * SERVING_MULTIPLIERS.kid;
    const costPerServing = totalServings > 0 ? totalSpent / totalServings : 0;

    let status: "under_budget" | "on_track" | "over_budget";
    if (budgetUtilized < 80) {
      status = "under_budget";
    } else if (budgetUtilized <= 100) {
      status = "on_track";
    } else {
      status = "over_budget";
    }

    return {
      totalEventCost: totalSpent,
      budgetAllocated: budgetAllocated || undefined,
      budgetUtilized,
      remaining: budgetAllocated - totalSpent,
      costPerAdult,
      costPerKid,
      costPerServing,
      status,
    };
  }

  async getAccountEventStats(
    accountId: string,
    requesterId: string,
  ): Promise<EventStats> {
    await this.validateAccountAccess(
      requesterId,
      accountId,
      "view event stats",
    );
    return await this.eventRepo.getStats(accountId);
  }

  // Event Extra Items
  async addExtraItem(
    eventId: string,
    data: CreateEventExtraItemDto,
    requesterId: string,
  ): Promise<EventExtraItemResponseDto> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "add extra items",
    );

    const item = await this.eventRepo.addExtraItem(eventId, data);
    return this.mapExtraItemToDto(item);
  }

  async addExtraItems(
    eventId: string,
    data: CreateEventExtraItemDto[],
    requesterId: string,
  ): Promise<EventExtraItemResponseDto[]> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "add extra items to events",
    );

    const results = await this.eventRepo.addExtraItems(eventId, data);
    return results.map((item) => this.mapExtraItemToDto(item));
  }

  async updateExtraItem(
    eventId: string,
    itemId: string,
    data: UpdateEventExtraItemDto,
    requesterId: string,
  ): Promise<EventExtraItemResponseDto> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "update extra items",
    );

    const updatedItem = await this.eventRepo.updateExtraItem(itemId, data);
    return this.mapExtraItemToDto(updatedItem);
  }

  async deleteExtraItem(
    eventId: string,
    itemId: string,
    requesterId: string,
  ): Promise<void> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "delete extra items",
    );

    await this.eventRepo.deleteExtraItem(itemId);
  }

  async getExtraItems(
    eventId: string,
    requesterId: string,
  ): Promise<EventExtraItemResponseDto[]> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAccountAccess(
      requesterId,
      event.accountId,
      "view extra items",
    );

    const items = await this.eventRepo.getExtraItemsByEventId(eventId);
    return items.map((item) => this.mapExtraItemToDto(item));
  }

  // Event Generation State
  async getGenerationState(eventId: string, requesterId: string): Promise<any> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAccountAccess(
      requesterId,
      event.accountId,
      "view generation state",
    );

    const state = await this.eventRepo.getGenerationState(eventId);
    return state;
  }

  async saveGenerationState(
    eventId: string,
    stateData: any,
    requesterId: string,
    lastStep?: string,
  ): Promise<void> {
    const event = await this.eventRepo.findById(eventId, false);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAdminAccess(
      requesterId,
      event.accountId,
      "save generation state",
    );

    await this.eventRepo.saveGenerationState(eventId, stateData, lastStep);
  }

  // Budget Tracking
  async getBudgetTracking(
    eventId: string,
    requesterId: string,
  ): Promise<BudgetTrackingResponseDto> {
    const event = await this.eventRepo.findById(eventId, true);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    await this.validateAccountAccess(
      requesterId,
      event.accountId,
      "view budget tracking",
    );

    const totalBudget = event.budget
      ? parseFloat(event.budget.totalBudget as any)
      : 0;
    const allocations =
      (event.budget?.allocations as Record<string, number>) || {};
    const currency = event.budget?.currency || "USD";

    // Get all meals with their recipes
    const meals = await this.eventRepo.getMealsByEventId(eventId);
    const mealBreakdown: MealBudgetTrackingDto[] = [];
    let totalSpent = 0;
    let totalAllocated = 0;

    for (const meal of meals) {
      const recipes = await this.eventRepo.getRecipesByMealId(meal.id);
      const mealSpent = recipes.reduce((sum: number, r: any) => {
        return sum + (parseFloat(r.estimatedCost as any) || 0);
      }, 0);

      const allocated = allocations[meal.mealType] || 0;
      totalSpent += mealSpent;
      totalAllocated += allocated;

      mealBreakdown.push({
        mealType: meal.mealType,
        allocated,
        spent: mealSpent,
        remaining: allocated - mealSpent,
        recipeCount: recipes.length,
        utilizationPercent: allocated > 0 ? (mealSpent / allocated) * 100 : 0,
      });
    }

    // Add meal types that have allocations but no meals yet
    for (const [mealType, allocated] of Object.entries(allocations)) {
      if (!mealBreakdown.find((m) => m.mealType === mealType)) {
        totalAllocated += allocated;
        mealBreakdown.push({
          mealType,
          allocated,
          spent: 0,
          remaining: allocated,
          recipeCount: 0,
          utilizationPercent: 0,
        });
      }
    }

    const utilizationPercent =
      totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    let status: "under_budget" | "on_track" | "over_budget" = "on_track";
    if (utilizationPercent > 100) {
      status = "over_budget";
    } else if (utilizationPercent < 70) {
      status = "under_budget";
    }

    return {
      eventId,
      eventName: event.name,
      totalBudget,
      totalAllocated,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      currency,
      utilizationPercent,
      status,
      mealBreakdown,
    };
  }
}

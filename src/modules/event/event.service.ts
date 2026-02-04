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
} from "./types/event.types.js";
import {
  IMemberRepository,
  MemberRepository,
} from "../member/member.repository.js";

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
}

export class EventService implements IEventService {
  constructor(
    private readonly eventRepo: IEventRepository = new EventRepository(),
    private readonly memberRepo: IMemberRepository = new MemberRepository(),
  ) {}

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
    }

    // TODO: Aggregate ingredients from all event recipes and add to shopping list

    return shoppingList;
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
}

import { eq, and, sql, gte, lte, or, desc, asc, ilike } from "drizzle-orm";
import {
  events,
  eventBudget,
  eventParticipants,
  eventMeals,
  eventRecipes,
  eventShoppingLists,
  eventShoppingItems,
  eventMemberLogs,
  members,
  recipes,
  eventExtraItems,
} from "../../database/schemas/schema.js";
import { getDb } from "../../database/db.js";
import {
  Event,
  EventWithRelations,
  EventMeal,
  EventRecipe,
  EventShoppingList,
  EventShoppingItem,
  EventMemberLog,
  EventQueryOptions,
  PaginatedResult,
  EventStats,
  SERVING_MULTIPLIERS,
  EventExtraItem,
} from "./types/event.types.js";
import {
  CreateEventDto,
  UpdateEventDto,
  CreateEventMealDto,
  UpdateEventMealDto,
  AddRecipeToMealDto,
  CreateShoppingListDto,
  UpdateShoppingListDto,
  LogMemberConsumptionDto,
  CreateEventExtraItemDto,
  UpdateEventExtraItemDto,
} from "./dto/event.dto.js";

export interface IEventRepository {
  // Event CRUD
  create(
    data: CreateEventDto,
    accountId: string,
    createdBy: string,
  ): Promise<Event>;
  findById(
    id: string,
    withRelations?: boolean,
  ): Promise<EventWithRelations | null>;
  update(id: string, data: UpdateEventDto): Promise<Event>;
  delete(id: string): Promise<void>;
  findAll(
    options: EventQueryOptions,
  ): Promise<PaginatedResult<EventWithRelations>>;

  // Event Participants
  addParticipant(eventId: string, memberId: string): Promise<void>;
  removeParticipant(eventId: string, memberId: string): Promise<void>;
  getParticipants(eventId: string): Promise<any[]>;
  setParticipants(eventId: string, memberIds: string[]): Promise<void>;

  // Event Budget
  createBudget(
    eventId: string,
    budget: number,
    currency: string,
  ): Promise<void>;
  updateBudget(
    eventId: string,
    data: Partial<{ totalBudget: number; totalSpent: number }>,
  ): Promise<void>;

  // Event Meals
  createMeal(eventId: string, data: CreateEventMealDto): Promise<EventMeal>;
  updateMeal(mealId: string, data: UpdateEventMealDto): Promise<EventMeal>;
  deleteMeal(mealId: string): Promise<void>;
  getMealsByEventId(eventId: string): Promise<EventMeal[]>;
  getMealById(mealId: string): Promise<EventMeal | null>;

  // Event Recipes
  addRecipeToMeal(
    mealId: string,
    data: AddRecipeToMealDto,
    scalingFactor: number,
  ): Promise<EventRecipe>;
  removeRecipeFromMeal(recipeId: string): Promise<void>;
  getRecipesByMealId(mealId: string): Promise<EventRecipe[]>;

  // Shopping Lists
  createShoppingList(
    eventId: string,
    data?: CreateShoppingListDto,
  ): Promise<EventShoppingList>;
  updateShoppingList(
    shoppingListId: string,
    data: UpdateShoppingListDto,
  ): Promise<EventShoppingList>;
  getShoppingListByEventId(eventId: string): Promise<EventShoppingList | null>;
  addShoppingItem(
    shoppingListId: string,
    item: any,
  ): Promise<EventShoppingItem>;
  updateShoppingItem(
    itemId: string,
    data: Partial<EventShoppingItem>,
  ): Promise<void>;

  // Member Logs
  logMemberConsumption(
    eventId: string,
    data: LogMemberConsumptionDto,
  ): Promise<EventMemberLog>;
  getMemberLogs(eventId: string): Promise<EventMemberLog[]>;

  // Stats & Analytics
  getStats(accountId: string): Promise<EventStats>;
  getUpcomingEvents(accountId: string, limit?: number): Promise<Event[]>;

  // Event Extra Items
  addExtraItem(
    eventId: string,
    data: CreateEventExtraItemDto,
  ): Promise<EventExtraItem>;
  updateExtraItem(
    itemId: string,
    data: UpdateEventExtraItemDto,
  ): Promise<EventExtraItem>;
  deleteExtraItem(itemId: string): Promise<void>;
  getExtraItemsByEventId(eventId: string): Promise<EventExtraItem[]>;
}

export class EventRepository implements IEventRepository {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
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

  async create(
    data: CreateEventDto,
    accountId: string,
    createdBy: string,
  ): Promise<Event> {
    const eventData = {
      accountId,
      name: data.name,
      occasionType: data.occasionType,
      eventDate: new Date(data.eventDate),
      eventTime: data.eventTime || null,
      description: data.description || null,
      status: "draft",
      budgetType: data.budgetType,
      budgetAmount: data.budgetAmount?.toString() || null,
      adultGuests: data.adultGuests || 0,
      kidGuests: data.kidGuests || 0,
      selectedMealTypes: data.selectedMealTypes || [],
      guestNotes: data.guestNotes || null,
      createdBy,
    };

    const [result] = await this.db.insert(events).values(eventData).returning();

    // Create budget if separate budget type
    if (data.budgetType === "separate" && data.budgetAmount) {
      await this.createBudget(
        result.id,
        data.budgetAmount,
        data.currency || "INR",
      );
    }

    // Add participants if provided
    if (data.selectedMemberIds && data.selectedMemberIds.length > 0) {
      await this.setParticipants(result.id, data.selectedMemberIds);
    }

    return result;
  }

  async findById(
    id: string,
    withRelations = false,
  ): Promise<EventWithRelations | null> {
    const [event] = await this.db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!event) return null;

    if (!withRelations) {
      return event;
    }

    // Get participants
    const participants = await this.getParticipants(id);

    // Get budget
    const [budget] = await this.db
      .select()
      .from(eventBudget)
      .where(eq(eventBudget.eventId, id))
      .limit(1);

    // Get meals with recipes
    const meals = await this.getMealsByEventId(id);

    // Get shopping list with items
    const shoppingList = await this.getShoppingListByEventId(id);

    return {
      ...event,
      participants,
      budget: budget || null,
      meals,
      shoppingList,
      extraItems: await this.getExtraItemsByEventId(id),
    };
  }

  async update(id: string, data: UpdateEventDto): Promise<Event> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.occasionType !== undefined)
      updateData.occasionType = data.occasionType;
    if (data.eventDate !== undefined)
      updateData.eventDate = new Date(data.eventDate);
    if (data.eventTime !== undefined) updateData.eventTime = data.eventTime;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.budgetType !== undefined) updateData.budgetType = data.budgetType;
    if (data.budgetAmount !== undefined)
      updateData.budgetAmount = data.budgetAmount.toString();
    if (data.adultGuests !== undefined)
      updateData.adultGuests = data.adultGuests;
    if (data.kidGuests !== undefined) updateData.kidGuests = data.kidGuests;
    if (data.guestNotes !== undefined) updateData.guestNotes = data.guestNotes;
    if (data.actualCost !== undefined)
      updateData.actualCost = data.actualCost.toString();

    updateData.updatedAt = new Date();

    const [updated] = await this.db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();

    // Update participants if provided
    if (data.selectedMemberIds !== undefined) {
      await this.setParticipants(id, data.selectedMemberIds);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(events).where(eq(events.id, id));
  }

  async findAll(
    options: EventQueryOptions,
  ): Promise<PaginatedResult<EventWithRelations>> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      accountId,
      status,
      occasionType,
      fromDate,
      toDate,
      search,
    } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(events.accountId, accountId)];

    if (status) conditions.push(eq(events.status, status));
    if (occasionType) conditions.push(eq(events.occasionType, occasionType));
    if (fromDate) conditions.push(gte(events.eventDate, new Date(fromDate)));
    if (toDate) conditions.push(lte(events.eventDate, new Date(toDate)));
    if (search) {
      conditions.push(
        or(
          ilike(events.name, `%${search}%`),
          ilike(events.description, `%${search}%`),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const sortColumnMap: Record<string, any> = {
      eventDate: events.eventDate,
      name: events.name,
      createdAt: events.createdAt,
      status: events.status,
    };

    const sortColumn = sortColumnMap[sortBy] || events.eventDate;
    const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [data, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(events)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(events)
        .where(whereClause),
    ]);

    // Fetch related data for each event
    const eventsWithRelations = await Promise.all(
      data.map(async (event: any) => {
        const participants = await this.getParticipants(event.id);
        const [budget] = await this.db
          .select()
          .from(eventBudget)
          .where(eq(eventBudget.eventId, event.id))
          .limit(1);
        const meals = await this.getMealsByEventId(event.id);

        return {
          ...event,
          participants,
          budget: budget || null,
          meals,
        };
      }),
    );

    const total = Number(count);
    const totalPages = Math.ceil(total / limit);

    return {
      data: eventsWithRelations,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // Event Participants
  async addParticipant(eventId: string, memberId: string): Promise<void> {
    await this.db
      .insert(eventParticipants)
      .values({ eventId, memberId })
      .onConflictDoNothing();
  }

  async removeParticipant(eventId: string, memberId: string): Promise<void> {
    await this.db
      .delete(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.memberId, memberId),
        ),
      );
  }

  async getParticipants(eventId: string): Promise<any[]> {
    return await this.db
      .select({
        id: eventParticipants.id,
        eventId: eventParticipants.eventId,
        memberId: eventParticipants.memberId,
        createdAt: eventParticipants.createdAt,
        member: {
          id: members.id,
          name: members.name,
          age: members.age,
          role: members.role,
        },
      })
      .from(eventParticipants)
      .leftJoin(members, eq(eventParticipants.memberId, members.id))
      .where(eq(eventParticipants.eventId, eventId));
  }

  async setParticipants(eventId: string, memberIds: string[]): Promise<void> {
    // Remove all existing participants
    await this.db
      .delete(eventParticipants)
      .where(eq(eventParticipants.eventId, eventId));

    // Add new participants
    if (memberIds.length > 0) {
      await this.db
        .insert(eventParticipants)
        .values(memberIds.map((memberId) => ({ eventId, memberId })));
    }
  }

  // Event Budget
  async createBudget(
    eventId: string,
    budget: number,
    currency: string,
  ): Promise<void> {
    await this.db.insert(eventBudget).values({
      eventId,
      totalBudget: budget.toString(),
      totalSpent: "0",
      currency,
    });
  }

  async updateBudget(
    eventId: string,
    data: Partial<{ totalBudget: number; totalSpent: number }>,
  ): Promise<void> {
    const updateData: any = {};
    if (data.totalBudget !== undefined)
      updateData.totalBudget = data.totalBudget.toString();
    if (data.totalSpent !== undefined)
      updateData.totalSpent = data.totalSpent.toString();

    await this.db
      .update(eventBudget)
      .set(updateData)
      .where(eq(eventBudget.eventId, eventId));
  }

  // Event Meals
  async createMeal(
    eventId: string,
    data: CreateEventMealDto,
  ): Promise<EventMeal> {
    const [result] = await this.db
      .insert(eventMeals)
      .values({
        eventId,
        mealType: data.mealType,
        scheduledTime: data.scheduledTime || null,
        notes: data.notes || null,
        status: "planned",
      })
      .returning();

    return result;
  }

  async updateMeal(
    mealId: string,
    data: UpdateEventMealDto,
  ): Promise<EventMeal> {
    const updateData: any = {};
    if (data.mealType !== undefined) updateData.mealType = data.mealType;
    if (data.scheduledTime !== undefined)
      updateData.scheduledTime = data.scheduledTime;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.estimatedCost !== undefined)
      updateData.estimatedCost = data.estimatedCost.toString();
    if (data.actualCost !== undefined)
      updateData.actualCost = data.actualCost.toString();
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [updated] = await this.db
      .update(eventMeals)
      .set(updateData)
      .where(eq(eventMeals.id, mealId))
      .returning();

    return updated;
  }

  async deleteMeal(mealId: string): Promise<void> {
    await this.db.delete(eventMeals).where(eq(eventMeals.id, mealId));
  }

  async getMealsByEventId(eventId: string): Promise<EventMeal[]> {
    const meals = await this.db
      .select()
      .from(eventMeals)
      .where(eq(eventMeals.eventId, eventId));

    // Get recipes for each meal
    const mealsWithRecipes = await Promise.all(
      meals.map(async (meal: any) => {
        const mealRecipes = await this.getRecipesByMealId(meal.id);
        return { ...meal, recipes: mealRecipes };
      }),
    );

    return mealsWithRecipes;
  }

  async getMealById(mealId: string): Promise<EventMeal | null> {
    const [meal] = await this.db
      .select()
      .from(eventMeals)
      .where(eq(eventMeals.id, mealId))
      .limit(1);

    return meal || null;
  }

  // Event Recipes
  async addRecipeToMeal(
    mealId: string,
    data: AddRecipeToMealDto,
    scalingFactor: number,
  ): Promise<EventRecipe> {
    // Get the recipe to calculate estimated cost
    const [recipe] = await this.db
      .select()
      .from(recipes)
      .where(eq(recipes.id, data.recipeId))
      .limit(1);

    const estimatedCost = recipe?.estimatedCostPerServing
      ? parseFloat(recipe.estimatedCostPerServing) *
        (data.servings || recipe.servings) *
        scalingFactor
      : null;

    const [result] = await this.db
      .insert(eventRecipes)
      .values({
        eventMealId: mealId,
        recipeId: data.recipeId,
        servings: data.servings || recipe?.servings || 1,
        scalingFactor: scalingFactor.toString(),
        estimatedCost: estimatedCost?.toString() || null,
        notes: data.notes || null,
      })
      .returning();

    return result;
  }

  async removeRecipeFromMeal(recipeId: string): Promise<void> {
    await this.db.delete(eventRecipes).where(eq(eventRecipes.id, recipeId));
  }

  async getRecipesByMealId(mealId: string): Promise<EventRecipe[]> {
    const eventRecipesList = await this.db
      .select({
        id: eventRecipes.id,
        eventMealId: eventRecipes.eventMealId,
        recipeId: eventRecipes.recipeId,
        servings: eventRecipes.servings,
        scalingFactor: eventRecipes.scalingFactor,
        estimatedCost: eventRecipes.estimatedCost,
        notes: eventRecipes.notes,
        createdAt: eventRecipes.createdAt,
        recipe: {
          id: recipes.id,
          name: recipes.name,
          description: recipes.description,
          servings: recipes.servings,
          prepTimeMinutes: recipes.prepTimeMinutes,
          cookTimeMinutes: recipes.cookTimeMinutes,
          difficultyLevel: recipes.difficultyLevel,
          cuisineType: recipes.cuisineType,
          imageUrl: recipes.imageUrl,
          estimatedCostPerServing: recipes.estimatedCostPerServing,
          calories: recipes.calories,
        },
      })
      .from(eventRecipes)
      .leftJoin(recipes, eq(eventRecipes.recipeId, recipes.id))
      .where(eq(eventRecipes.eventMealId, mealId));

    return eventRecipesList;
  }

  // Shopping Lists
  async createShoppingList(
    eventId: string,
    data?: CreateShoppingListDto,
  ): Promise<EventShoppingList> {
    const [result] = await this.db
      .insert(eventShoppingLists)
      .values({
        eventId,
        status: "draft",
      })
      .returning();

    // Add items if provided
    if (data?.items && data.items.length > 0) {
      for (const item of data.items) {
        await this.addShoppingItem(result.id, item);
      }
    }

    return result;
  }

  async updateShoppingList(
    shoppingListId: string,
    data: UpdateShoppingListDto,
  ): Promise<EventShoppingList> {
    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.totalEstimated !== undefined)
      updateData.totalEstimated = data.totalEstimated.toString();
    if (data.totalActual !== undefined)
      updateData.totalActual = data.totalActual.toString();
    if (data.receiptUrl !== undefined) updateData.receiptUrl = data.receiptUrl;

    const [updated] = await this.db
      .update(eventShoppingLists)
      .set(updateData)
      .where(eq(eventShoppingLists.id, shoppingListId))
      .returning();

    return updated;
  }

  async getShoppingListByEventId(
    eventId: string,
  ): Promise<EventShoppingList | null> {
    const [shoppingList] = await this.db
      .select()
      .from(eventShoppingLists)
      .where(eq(eventShoppingLists.eventId, eventId))
      .limit(1);

    if (!shoppingList) return null;

    // Get items
    const items = await this.db
      .select()
      .from(eventShoppingItems)
      .where(eq(eventShoppingItems.shoppingListId, shoppingList.id));

    return { ...shoppingList, items };
  }

  async addShoppingItem(
    shoppingListId: string,
    item: any,
  ): Promise<EventShoppingItem> {
    const [result] = await this.db
      .insert(eventShoppingItems)
      .values({
        shoppingListId,
        ingredientId: item.ingredientId || null,
        ingredientName: item.ingredientName,
        quantity: item.quantity.toString(),
        unit: item.unit,
        estimatedPrice: item.estimatedPrice?.toString() || null,
        category: item.category || null,
        isPurchased: false,
      })
      .returning();

    return result;
  }

  async updateShoppingItem(
    itemId: string,
    data: Partial<EventShoppingItem>,
  ): Promise<void> {
    const updateData: any = {};
    if (data.quantity !== undefined)
      updateData.quantity = data.quantity.toString();
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.estimatedPrice !== undefined)
      updateData.estimatedPrice = data.estimatedPrice.toString();
    if (data.actualPrice !== undefined)
      updateData.actualPrice = data.actualPrice.toString();
    if (data.isPurchased !== undefined)
      updateData.isPurchased = data.isPurchased;

    await this.db
      .update(eventShoppingItems)
      .set(updateData)
      .where(eq(eventShoppingItems.id, itemId));
  }

  // Member Logs
  async logMemberConsumption(
    eventId: string,
    data: LogMemberConsumptionDto,
  ): Promise<EventMemberLog> {
    const [result] = await this.db
      .insert(eventMemberLogs)
      .values({
        eventId,
        memberId: data.memberId,
        consumedRecipeIds: data.consumedRecipeIds,
      })
      .returning();

    return result;
  }

  async getMemberLogs(eventId: string): Promise<EventMemberLog[]> {
    return await this.db
      .select()
      .from(eventMemberLogs)
      .where(eq(eventMemberLogs.eventId, eventId));
  }

  // Stats & Analytics
  async getStats(accountId: string): Promise<EventStats> {
    const [stats] = await this.db
      .select({
        total: sql<number>`count(*)`,
        upcoming: sql<number>`count(*) filter (where ${events.eventDate} > now() and ${events.status} != 'cancelled')`,
        completed: sql<number>`count(*) filter (where ${events.status} = 'completed')`,
        cancelled: sql<number>`count(*) filter (where ${events.status} = 'cancelled')`,
        totalSpent: sql<number>`coalesce(sum(cast(${events.actualCost} as decimal)), 0)`,
      })
      .from(events)
      .where(eq(events.accountId, accountId));

    const totalEvents = Number(stats.total);
    const completedEvents = Number(stats.completed);
    const totalSpent = Number(stats.totalSpent);

    return {
      totalEvents,
      upcomingEvents: Number(stats.upcoming),
      completedEvents,
      cancelledEvents: Number(stats.cancelled),
      totalSpent,
      averageCostPerEvent:
        completedEvents > 0 ? totalSpent / completedEvents : 0,
      averageCostPerGuest: 0, // Would need more calculation
    };
  }

  async getUpcomingEvents(accountId: string, limit = 5): Promise<Event[]> {
    return await this.db
      .select()
      .from(events)
      .where(
        and(
          eq(events.accountId, accountId),
          gte(events.eventDate, new Date()),
          sql`${events.status} != 'cancelled'`,
        ),
      )
      .orderBy(asc(events.eventDate))
      .limit(limit);
  }

  // Event Extra Items
  async addExtraItem(
    eventId: string,
    data: CreateEventExtraItemDto,
  ): Promise<EventExtraItem> {
    const [result] = await this.db
      .insert(eventExtraItems)
      .values({
        eventId,
        name: data.name,
        quantity: data.quantity.toString(),
        unit: data.unit,
        category: data.category || null,
        estimatedCost: data.estimatedCost?.toString() || null,
        actualCost: data.actualCost?.toString() || null,
        notes: data.notes || null,
      })
      .returning();
    return result;
  }

  async updateExtraItem(
    itemId: string,
    data: UpdateEventExtraItemDto,
  ): Promise<EventExtraItem> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.quantity !== undefined)
      updateData.quantity = data.quantity.toString();
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.estimatedCost !== undefined)
      updateData.estimatedCost = data.estimatedCost.toString();
    if (data.actualCost !== undefined)
      updateData.actualCost = data.actualCost.toString();
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [updated] = await this.db
      .update(eventExtraItems)
      .set(updateData)
      .where(eq(eventExtraItems.id, itemId))
      .returning();
    return updated;
  }

  async deleteExtraItem(itemId: string): Promise<void> {
    await this.db.delete(eventExtraItems).where(eq(eventExtraItems.id, itemId));
  }

  async getExtraItemsByEventId(eventId: string): Promise<EventExtraItem[]> {
    return await this.db
      .select()
      .from(eventExtraItems)
      .where(eq(eventExtraItems.eventId, eventId));
  }
}

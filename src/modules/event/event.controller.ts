import { Response, NextFunction } from "express";
import { IEventService, EventService } from "./event.service.js";
import {
  createEventSchema,
  updateEventSchema,
  getEventsQuerySchema,
  createEventMealSchema,
  updateEventMealSchema,
  addRecipeToMealSchema,
  generateMenuSchema,
  logMemberConsumptionSchema,
  eventRecipeGenerationSchema,
} from "./dto/event.dto.js";
import { sendResponse } from "@/utils/response.utils.js";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware.js";
import { AppError } from "@/utils/app-error.utils.js";
import { EventAIService } from "./services/event-ai.service.js";
import { MealType } from "./types/event.types.js";

export class EventController {
  private readonly eventAIService: EventAIService;

  constructor(
    private readonly eventService: IEventService = new EventService(),
  ) {
    this.eventAIService = new EventAIService();
  }

  // ===== Event CRUD =====
  createEvent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const accountId = req.headers["x-account-id"] as string;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }
      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }

      const validatedData = createEventSchema.parse(req.body);
      const event = await this.eventService.createEvent(
        validatedData,
        accountId,
        userId,
      );

      sendResponse(res, event, "Event created successfully", 201);
    } catch (error) {
      next(error);
    }
  };

  getEventById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const event = await this.eventService.getEventById(id, userId);

      sendResponse(res, event);
    } catch (error) {
      next(error);
    }
  };

  updateEvent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const validatedData = updateEventSchema.parse(req.body);
      const event = await this.eventService.updateEvent(
        id,
        validatedData,
        userId,
      );

      sendResponse(res, event, "Event updated successfully");
    } catch (error) {
      next(error);
    }
  };

  deleteEvent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      await this.eventService.deleteEvent(id, userId);

      sendResponse(res, null, "Event deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  getEvents = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const accountId =
        (req.headers["x-account-id"] as string) ||
        (req.query.accountId as string);

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }
      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }

      const query = getEventsQuerySchema.parse({
        ...req.query,
        accountId,
      });

      const events = await this.eventService.getEvents(query, userId);

      sendResponse(res, events);
    } catch (error) {
      next(error);
    }
  };

  // ===== Event Meals =====
  addMealToEvent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const validatedData = createEventMealSchema.parse(req.body);
      const meal = await this.eventService.addMealToEvent(
        eventId,
        validatedData,
        userId,
      );

      sendResponse(res, meal, "Meal added to event", 201);
    } catch (error) {
      next(error);
    }
  };

  updateEventMeal = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId, mealId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const validatedData = updateEventMealSchema.parse(req.body);
      const meal = await this.eventService.updateEventMeal(
        eventId,
        mealId,
        validatedData,
        userId,
      );

      sendResponse(res, meal, "Meal updated");
    } catch (error) {
      next(error);
    }
  };

  deleteEventMeal = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId, mealId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      await this.eventService.deleteEventMeal(eventId, mealId, userId);

      sendResponse(res, null, "Meal deleted from event");
    } catch (error) {
      next(error);
    }
  };

  getEventMeals = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const meals = await this.eventService.getEventMeals(eventId, userId);

      sendResponse(res, meals);
    } catch (error) {
      next(error);
    }
  };

  // ===== Event Recipes =====
  addRecipeToMeal = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId, mealId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const validatedData = addRecipeToMealSchema.parse(req.body);
      const recipe = await this.eventService.addRecipeToMeal(
        eventId,
        mealId,
        validatedData,
        userId,
      );

      sendResponse(res, recipe, "Recipe added to meal", 201);
    } catch (error) {
      next(error);
    }
  };

  removeRecipeFromMeal = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId, mealId, recipeId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      await this.eventService.removeRecipeFromMeal(
        eventId,
        mealId,
        recipeId,
        userId,
      );

      sendResponse(res, null, "Recipe removed from meal");
    } catch (error) {
      next(error);
    }
  };

  // ===== Menu Generation =====
  generateMenu = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const validatedData = generateMenuSchema.parse(req.body);
      const meals = await this.eventService.generateMenu(
        eventId,
        validatedData,
        userId,
      );

      sendResponse(res, meals, "Menu generated", 201);
    } catch (error) {
      next(error);
    }
  };

  // ===== Shopping List =====
  generateShoppingList = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const shoppingList = await this.eventService.generateShoppingList(
        eventId,
        userId,
      );

      sendResponse(res, shoppingList, "Shopping list generated", 201);
    } catch (error) {
      next(error);
    }
  };

  getEventShoppingList = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const shoppingList = await this.eventService.getEventShoppingList(
        eventId,
        userId,
      );

      sendResponse(res, shoppingList);
    } catch (error) {
      next(error);
    }
  };

  approveShoppingList = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const shoppingList = await this.eventService.approveShoppingList(
        eventId,
        userId,
      );

      sendResponse(res, shoppingList, "Shopping list approved");
    } catch (error) {
      next(error);
    }
  };

  uploadReceipt = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId } = req.params;
      const { receiptUrl } = req.body;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }
      if (!receiptUrl) {
        throw new AppError("Receipt URL is required", 400);
      }

      const shoppingList = await this.eventService.uploadReceipt(
        eventId,
        receiptUrl,
        userId,
      );

      sendResponse(res, shoppingList, "Receipt uploaded");
    } catch (error) {
      next(error);
    }
  };

  // ===== Event Completion =====
  completeEvent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const event = await this.eventService.completeEvent(eventId, userId);

      sendResponse(res, event, "Event marked as complete");
    } catch (error) {
      next(error);
    }
  };

  logMemberConsumption = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const validatedData = logMemberConsumptionSchema.parse(req.body);
      await this.eventService.logMemberConsumption(
        eventId,
        validatedData,
        userId,
      );

      sendResponse(res, null, "Member consumption logged");
    } catch (error) {
      next(error);
    }
  };

  // ===== Analytics =====
  getEventAnalytics = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }

      const analytics = await this.eventService.getEventAnalytics(
        eventId,
        userId,
      );

      sendResponse(res, analytics);
    } catch (error) {
      next(error);
    }
  };

  getAccountEventStats = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const accountId =
        (req.headers["x-account-id"] as string) ||
        (req.query.accountId as string);

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }
      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }

      const stats = await this.eventService.getAccountEventStats(
        accountId,
        userId,
      );

      sendResponse(res, stats);
    } catch (error) {
      next(error);
    }
  };

  // ===== AI-Powered Budget Suggestion =====
  suggestBudget = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const accountId = req.headers["x-account-id"] as string;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }
      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }

      const budgetSuggestion =
        await this.eventAIService.suggestBudgetAllocation({
          eventId,
          accountId,
          requesterId: userId,
        });

      sendResponse(res, budgetSuggestion, "Budget allocation suggested by AI");
    } catch (error) {
      next(error);
    }
  };

  // ===== AI-Powered Event Recipe Generation =====
  generateEventRecipes = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user?.id;
      const accountId = req.headers["x-account-id"] as string;
      const { id: eventId } = req.params;

      if (!userId) {
        throw new AppError("Unauthorized", 401);
      }
      if (!accountId) {
        throw new AppError("Account ID is required", 400);
      }

      const validatedData = eventRecipeGenerationSchema.parse(req.body);

      const recipes = await this.eventAIService.generateEventRecipes({
        eventId,
        accountId,
        requesterId: userId,
        mealType: validatedData.mealType as MealType,
        recipeCount: validatedData.recipeCount,
        budget: validatedData.budget,
        preferredCuisines: validatedData.preferredCuisines,
        customSearch: validatedData.customSearch,
        considerHealthProfiles: validatedData.considerHealthProfiles,
        targetMemberIds: validatedData.targetMemberIds,
      });

      sendResponse(res, recipes, "Event recipes generated successfully", 201);
    } catch (error) {
      next(error);
    }
  };
}

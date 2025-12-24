import { Router } from "express";
import { PantryItemsStorage } from "../modules/pantry/pantry.repository.js";
import { PantryItemsService } from "../modules/pantry/pantry.service.js";
import { PantryItemsController } from "../modules/pantry/pantry.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createPantryItemSchema,
  updatePantryItemSchema,
  getPantryItemsQuerySchema,
  pantryItemIdParamSchema,
  getExpiringItemsQuerySchema,
  alertIdParamSchema,
} from "../modules/pantry/dto/pantry.dto.js";

const pantryRoutes = Router();

const pantryItemsStorage = new PantryItemsStorage();
const pantryItemsService = new PantryItemsService(pantryItemsStorage);
const pantryItemsController = new PantryItemsController(pantryItemsService);

/**
 * Get all pantry items with pagination and filters
 */
pantryRoutes.get(
  "/",
  authenticate,
  // validate(getPantryItemsQuerySchema, "query"),
  pantryItemsController.getPantryItems,
);

/**
 * Get expiring items
 */
pantryRoutes.get(
  "/expiring",
  authenticate,
  validate(getExpiringItemsQuerySchema, "query"),
  pantryItemsController.getExpiringItems,
);

/**
 * Get pantry alerts
 */
pantryRoutes.get(
  "/alerts",
  authenticate,
  pantryItemsController.getPantryAlerts,
);

/**
 * Add new pantry item
 */
pantryRoutes.post(
  "/",
  authenticate,
  // validate(createPantryItemSchema, "body"),
  pantryItemsController.addPantryItem,
);

/**
 * Update pantry item
 */
pantryRoutes.put(
  "/:id",
  authenticate,
  validate(pantryItemIdParamSchema, "params"),
  validate(updatePantryItemSchema, "body"),
  pantryItemsController.updatePantryItem,
);

/**
 * Dismiss alert
 */
pantryRoutes.put(
  "/alerts/:id/dismiss",
  authenticate,
  validate(alertIdParamSchema, "params"),
  pantryItemsController.dismissAlert,
);

/**
 * Delete pantry item
 */
pantryRoutes.delete(
  "/:id",
  authenticate,
  validate(pantryItemIdParamSchema, "params"),
  pantryItemsController.deletePantryItem,
);

export default pantryRoutes;

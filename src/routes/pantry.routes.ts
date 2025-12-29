import { Router } from "express";
import { PantryItemsStorage } from "../modules/pantry/pantry.repository.js";
import { PantryItemsService } from "../modules/pantry/pantry.service.js";
import { PantryItemsController } from "../modules/pantry/pantry.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/authorization.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { PERMISSIONS } from "../common/permissions.config.js";
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

// All routes require authentication
pantryRoutes.use(authenticate);

/**
 * Get all pantry items with pagination and filters
 * @access Private (pantry:view permission)
 */
pantryRoutes.get(
  "/",
  requirePermission(PERMISSIONS.PANTRY_VIEW),
  pantryItemsController.getPantryItems,
);

/**
 * Get expiring items
 * @access Private (pantry:view permission)
 */
pantryRoutes.get(
  "/expiring",
  requirePermission(PERMISSIONS.PANTRY_VIEW),
  validate(getExpiringItemsQuerySchema, "query"),
  pantryItemsController.getExpiringItems,
);

/**
 * Get pantry alerts
 * @access Private (pantry:view permission)
 */
pantryRoutes.get(
  "/alerts",
  requirePermission(PERMISSIONS.PANTRY_VIEW),
  pantryItemsController.getPantryAlerts,
);

/**
 * Add new pantry item
 * @access Private (pantry:add permission)
 */
pantryRoutes.post(
  "/",
  requirePermission(PERMISSIONS.PANTRY_ADD),
  pantryItemsController.addPantryItem,
);

/**
 * Update pantry item
 * @access Private (pantry:update permission)
 */
pantryRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.PANTRY_UPDATE),
  validate(pantryItemIdParamSchema, "params"),
  validate(updatePantryItemSchema, "body"),
  pantryItemsController.updatePantryItem,
);

/**
 * Dismiss alert
 * @access Private (pantry:update permission)
 */
pantryRoutes.put(
  "/alerts/:id/dismiss",
  requirePermission(PERMISSIONS.PANTRY_UPDATE),
  validate(alertIdParamSchema, "params"),
  pantryItemsController.dismissAlert,
);

/**
 * Delete pantry item
 * @access Private (pantry:delete permission)
 */
pantryRoutes.delete(
  "/:id",
  requirePermission(PERMISSIONS.PANTRY_DELETE),
  validate(pantryItemIdParamSchema, "params"),
  pantryItemsController.deletePantryItem,
);

export default pantryRoutes;

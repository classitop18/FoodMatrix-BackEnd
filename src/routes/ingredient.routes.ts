import { Router } from "express";
import { IngredientsRepository } from "../modules/ingredients/ingredients.repository.js";
import { IngredientsService } from "../modules/ingredients/ingredients.service.js";
import { IngredientsController } from "../modules/ingredients/ingredients.controller.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
    getIngredientsQuerySchema,
    searchIngredientsQuerySchema,
    ingredientIdParamSchema,
    categoryParamSchema,
} from "../modules/ingredients/dto/ingredients.dto.js";

const ingredientRoutes = Router();

const ingredientsRepository = new IngredientsRepository();
const ingredientsService = new IngredientsService(ingredientsRepository);
const ingredientsController = new IngredientsController(ingredientsService);

/**
 * Get all ingredients with optional filters
 */
ingredientRoutes.get(
    "/",
    validate(getIngredientsQuerySchema, "query"),
    ingredientsController.getAllIngredients
);

/**
 * Get all unique categories
 */
ingredientRoutes.get("/categories", ingredientsController.getCategories);

/**
 * Search ingredients by name
 */
ingredientRoutes.get(
    "/search",
    validate(searchIngredientsQuerySchema, "query"),
    ingredientsController.searchIngredients
);

/**
 * Get ingredients by category
 */
ingredientRoutes.get(
    "/by-category/:category",
    validate(categoryParamSchema, "params"),
    ingredientsController.getByCategory
);

/**
 * Get single ingredient by ID
 */
ingredientRoutes.get(
    "/:id",
    validate(ingredientIdParamSchema, "params"),
    ingredientsController.getIngredientById
);

export default ingredientRoutes;

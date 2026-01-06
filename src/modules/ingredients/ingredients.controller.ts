import type { NextFunction, Response, Request } from "express";
import { IngredientsService } from "./ingredients.service.js";
import { sendResponse } from "../../utils/response.utils.js";
import { AppError } from "@/utils/app-error.utils.js";
import {
  getIngredientsQuerySchema,
  searchIngredientsQuerySchema,
  ingredientIdParamSchema,
  categoryParamSchema,
} from "./dto/ingredients.dto.js";

export class IngredientsController {
  private service: IngredientsService;

  constructor(service: IngredientsService) {
    this.service = service;
  }

  // ============ GET ALL INGREDIENTS ============
  getAllIngredients = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedQuery = getIngredientsQuerySchema.parse(req.query);
      const result = await this.service.getAllIngredients(validatedQuery);

      return sendResponse(res, result, "Ingredients fetched successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  // ============ GET INGREDIENT BY ID ============
  getIngredientById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedParams = ingredientIdParamSchema.parse(req.params);
      const result = await this.service.getIngredientById(validatedParams.id);

      if (!result) {
        throw new AppError("Ingredient not found", 404);
      }

      return sendResponse(res, result, "Ingredient fetched successfully", 200);
    } catch (error) {
      next(error);
    }
  };

  // ============ GET CATEGORIES ============
  getCategories = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.service.getCategories();
      return sendResponse(
        res,
        categories,
        "Categories fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  // ============ SEARCH INGREDIENTS ============
  searchIngredients = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const validatedQuery = searchIngredientsQuerySchema.parse(req.query);
      const result = await this.service.searchIngredients(
        validatedQuery.q,
        validatedQuery.limit,
      );

      return sendResponse(
        res,
        result,
        "Search results fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  // ============ GET BY CATEGORY ============
  getByCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedParams = categoryParamSchema.parse(req.params);
      const result = await this.service.getByCategory(validatedParams.category);

      return sendResponse(
        res,
        result,
        "Ingredients by category fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };
}

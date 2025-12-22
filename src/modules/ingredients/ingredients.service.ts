import { IngredientsRepository } from "./ingredients.repository.js";

export interface IngredientsQueryParams {
    category?: string;
    search?: string;
    limit?: number;
}

export class IngredientsService {
    private repository: IngredientsRepository;

    constructor(repository: IngredientsRepository) {
        this.repository = repository;
    }

    async getAllIngredients(params: IngredientsQueryParams) {
        return await this.repository.getAllIngredients(params);
    }

    async getIngredientById(id: string) {
        return await this.repository.getIngredientById(id);
    }

    async getCategories() {
        return await this.repository.getCategories();
    }

    async searchIngredients(query: string, limit: number = 20) {
        return await this.repository.searchIngredients(query, limit);
    }

    async getByCategory(category: string) {
        return await this.repository.getByCategory(category);
    }
}

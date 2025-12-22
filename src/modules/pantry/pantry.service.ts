import { PantryItemsStorage } from "./pantry.repository.js";
import { IngredientsRepository } from "../ingredients/ingredients.repository.js";
import type {
    CreatePantryItemPayload,
    UpdatePantryItemPayload,
    GetPantryItemsQuery,
} from "./dto/pantry.dto.js";
import type { PantryPaginatedResponse } from "./types/pantry.types.js";

export class PantryItemsService {
    private storage: PantryItemsStorage;

    constructor(storage: PantryItemsStorage) {
        this.storage = storage;
    }

    async getPantryItems(
        accountId: string,
        params: GetPantryItemsQuery
    ): Promise<PantryPaginatedResponse> {
        const { data, total } = await this.storage.getPantryItems(accountId, params);

        return {
            data: data as any,
            pagination: {
                page: params.page,
                limit: params.limit,
                total,
                totalPages: Math.ceil(total / params.limit),
            },
        };
    }

    async getExpiringItems(accountId: string, days: number = 7) {
        return await this.storage.getExpiringItems(accountId, days);
    }

    async getPantryAlerts(accountId: string) {
        return await this.storage.getPantryAlerts(accountId);
    }

    async dismissAlert(alertId: string): Promise<void> {
        await this.storage.dismissAlert(alertId);
    }

    private sanitizeDBDate(value: any): Date | null {
        if (!value) return null;
        if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }


    async addPantryItem(
        data: CreatePantryItemPayload & { accountId: string; addedBy?: string | null }
    ) {

        let targetIngredientId = data.ingredientId;

        // If no ID provided, we must find or create 
        if (!targetIngredientId && data.ingredientName) {
            const ingredientsRepo = new IngredientsRepository();

            // 1. Check if exists by name
            const existing = await ingredientsRepo.findByName(data.ingredientName);

            if (existing) {
                targetIngredientId = existing.id;
            } else {
                // 2. Create new
                // We trust 'category' is present because of Zod refine
                const newIng = await ingredientsRepo.createIngredient({
                    name: data.ingredientName,
                    category: data.category!,
                    defaultMeasurementUnit: data.unit // Use pantry item unit as default
                });
                targetIngredientId = newIng.id;
            }
        }

        if (!targetIngredientId) {
            throw new Error("Could not resolve ingredient ID");
        }

        const payload = {
            ...data,
            ingredientId: targetIngredientId, // Override with resolved ID
            expirationDate: this.sanitizeDBDate(data.expirationDate),
            costPaid: data.costPaid?.toString(),
            quantity: data.quantity.toString(),
        };

        // Remove ephemeral fields that are not in pantryItems schema
        delete (payload as any).ingredientName;
        // delete (payload as any).category; // category is not in CreatePantryItemPayload type definition but comes from flexible request body? No, Zod types it.
        // Actually, 'category' is in the Zod schema now but not in InsertPantryItem type. 
        // Spreading '...data' keeps it. 
        // We should explicitly construct payload to be safe or delete keys.

        console.log({ payload });

        return await this.storage.addPantryItem({
            accountId: payload.accountId,
            ingredientId: payload.ingredientId, // Assert string
            quantity: payload.quantity,
            unit: payload.unit,
            location: payload.location,
            expirationDate: payload.expirationDate,
            costPaid: payload.costPaid,
            addedBy: payload.addedBy
        });
    }

    async updatePantryItem(id: string, updates: UpdatePantryItemPayload) {
        const payload: any = { ...updates };

        if (updates.expirationDate !== undefined) {
            payload.expirationDate = this.sanitizeDBDate(updates.expirationDate);
        }

        if (updates.costPaid !== undefined) {
            payload.costPaid = updates.costPaid?.toString();
        }

        if (updates.quantity !== undefined) {
            payload.quantity = updates.quantity.toString();
        }

        return await this.storage.updatePantryItem(id, payload);
    }

    async deletePantryItem(id: string) {
        return await this.storage.deletePantryItem(id);
    }
}

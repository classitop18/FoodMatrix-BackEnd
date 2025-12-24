// Pantry Item Types

export interface PantryItem {
  id: string;
  accountId: string;
  ingredientId: string;
  quantity: string;
  unit: string;
  location: string;
  expirationDate?: Date | null;
  costPaid?: string | null;
  addedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PantryItemWithIngredient extends PantryItem {
  ingredient: {
    id: string;
    name: string;
    category: string;
    averagePrice?: string | null;
    averageUnit?: string | null;
    defaultMeasurementUnit?: string | null;
    isPerishable?: boolean | null;
    shelfLifeDays?: number | null;
    createdAt: Date;
  };
}

export interface PantryPaginatedResponse {
  data: PantryItemWithIngredient[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PantryAlert {
  id: string;
  accountId: string;
  pantryItemId?: string | null;
  alertType: "expiring_soon" | "expired" | "low_stock";
  message: string;
  severity: "info" | "warning" | "critical";
  isDismissed: boolean;
  dismissedAt?: Date | null;
  createdAt: Date;
}

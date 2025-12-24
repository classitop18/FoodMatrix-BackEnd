// Ingredient Types

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  averagePrice?: string | null;
  averageUnit?: string | null;
  defaultMeasurementUnit?: string | null;
  isPerishable?: boolean | null;
  shelfLifeDays?: number | null;
  createdAt: Date;
}

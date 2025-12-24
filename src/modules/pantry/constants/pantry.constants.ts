// Pantry Constants

export const STORAGE_LOCATIONS = [
  "refrigerator",
  "freezer",
  "pantry",
  "cabinet",
  "countertop",
] as const;

export const ALERT_TYPES = ["expiring_soon", "expired", "low_stock"] as const;

export const ALERT_SEVERITY = ["info", "warning", "critical"] as const;

export const SORT_FIELDS = ["createdAt", "expirationDate", "name"] as const;

export const SORT_ORDER = ["asc", "desc"] as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export const EXPIRY_WARNING_DAYS = 7;
export const EXPIRY_CRITICAL_DAYS = 3;

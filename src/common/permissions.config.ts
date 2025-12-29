/**
 * Centralized Permission Configuration
 * Defines all actions and role-based access control for FoodMatrix
 */

// ============ ROLE TYPES ============
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];

// Role hierarchy - higher number = more permissions
export const ROLE_HIERARCHY: Record<RoleType, number> = {
  member: 1,
  admin: 2,
  super_admin: 3,
};

// ============ PERMISSION ACTIONS ============
export const PERMISSIONS = {
  // Member management
  MEMBER_CREATE: "member:create",
  MEMBER_UPDATE: "member:update",
  MEMBER_DELETE: "member:delete",
  MEMBER_VIEW: "member:view",
  MEMBER_ROLE_UPDATE: "member:role_update",

  // Meal planning
  MEAL_CREATE: "meal:create",
  MEAL_UPDATE: "meal:update",
  MEAL_DELETE: "meal:delete",
  MEAL_VIEW: "meal:view",

  // Account settings
  ACCOUNT_UPDATE: "account:update",
  ACCOUNT_DELETE: "account:delete",
  ACCOUNT_VIEW: "account:view",

  // Pantry management
  PANTRY_ADD: "pantry:add",
  PANTRY_UPDATE: "pantry:update",
  PANTRY_DELETE: "pantry:delete",
  PANTRY_VIEW: "pantry:view",

  // Invitation management
  INVITE_SEND: "invite:send",
  INVITE_APPROVE: "invite:approve",
  INVITE_REJECT: "invite:reject",
  INVITE_VIEW: "invite:view",

  // Health profile
  HEALTH_PROFILE_VIEW: "health_profile:view",
  HEALTH_PROFILE_UPDATE: "health_profile:update",

  // Ingredients
  INGREDIENT_ADD: "ingredient:add",
  INGREDIENT_UPDATE: "ingredient:update",
} as const;

export type PermissionType = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ============ ROLE-PERMISSION MAPPING ============
/**
 * Defines which permissions each role has.
 * Use '*' for all permissions (super_admin only)
 * Use 'resource:*' for all actions on a resource (e.g., 'meal:*')
 */
export const ROLE_PERMISSIONS: Record<RoleType, string[]> = {
  super_admin: ["*"], // Full access to everything

  admin: [
    // Member management (except delete and role change)
    PERMISSIONS.MEMBER_CREATE,
    PERMISSIONS.MEMBER_UPDATE,
    PERMISSIONS.MEMBER_VIEW,

    // Meal planning - full access
    PERMISSIONS.MEAL_CREATE,
    PERMISSIONS.MEAL_UPDATE,
    PERMISSIONS.MEAL_DELETE,
    PERMISSIONS.MEAL_VIEW,

    // Pantry - full access
    PERMISSIONS.PANTRY_ADD,
    PERMISSIONS.PANTRY_UPDATE,
    PERMISSIONS.PANTRY_DELETE,
    PERMISSIONS.PANTRY_VIEW,

    // Invitation - can send, view
    PERMISSIONS.INVITE_SEND,
    PERMISSIONS.INVITE_VIEW,

    // Account - view only
    PERMISSIONS.ACCOUNT_VIEW,

    // Health profile - full access
    PERMISSIONS.HEALTH_PROFILE_VIEW,
    PERMISSIONS.HEALTH_PROFILE_UPDATE,

    // Ingredients
    PERMISSIONS.INGREDIENT_ADD,
    PERMISSIONS.INGREDIENT_UPDATE,
  ],

  member: [
    // View only permissions
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.MEAL_VIEW,
    PERMISSIONS.PANTRY_VIEW,
    PERMISSIONS.ACCOUNT_VIEW,
  ],
};

// ============ PERMISSION CHECKING UTILITIES ============

/**
 * Check if a role has a specific permission
 * Supports wildcards: '*' for all, 'resource:*' for all actions on resource
 */
export function hasPermission(role: RoleType, permission: string): boolean {
  const rolePerms = ROLE_PERMISSIONS[role];

  if (!rolePerms) return false;

  // Check for full wildcard
  if (rolePerms.includes("*")) return true;

  // Check for exact match
  if (rolePerms.includes(permission)) return true;

  // Check for resource wildcard (e.g., 'meal:*' matches 'meal:create')
  const [resource] = permission.split(":");
  if (rolePerms.includes(`${resource}:*`)) return true;

  return false;
}

/**
 * Check if roleA has higher or equal priority than roleB
 */
export function isRoleHigherOrEqual(roleA: RoleType, roleB: RoleType): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * Get all permissions for a role (expanded, no wildcards)
 */
export function getExpandedPermissions(role: RoleType): string[] {
  const rolePerms = ROLE_PERMISSIONS[role];

  if (!rolePerms) return [];

  // If has full wildcard, return all permissions
  if (rolePerms.includes("*")) {
    return Object.values(PERMISSIONS);
  }

  // Expand resource wildcards
  const expanded: string[] = [];
  const allPerms = Object.values(PERMISSIONS);

  for (const perm of rolePerms) {
    if (perm.endsWith(":*")) {
      const resource = perm.slice(0, -2);
      expanded.push(...allPerms.filter((p) => p.startsWith(`${resource}:`)));
    } else {
      expanded.push(perm);
    }
  }

  return [...new Set(expanded)];
}

import { z } from "zod";

/**
 * Login validation schema
 */
export const loginSchema = z.object({
    emailOrUsername: z
        .string({
            required_error: "Email or username is required",
        })
        .min(1, "Email or username cannot be empty")
        .trim(),

    password: z
        .string({
            required_error: "Password is required",
        })
        .min(1, "Password cannot be empty"),
});

/**
 * Refresh token validation schema
 */
export const refreshTokenSchema = z.object({
    refreshToken: z
        .string({
            required_error: "Refresh token is required",
        })
        .min(1, "Refresh token cannot be empty"),
});

/**
 * Session ID validation schema (for params)
 */
export const sessionIdSchema = z.object({
    sessionId: z
        .string({
            required_error: "Session ID is required",
        })
        .uuid("Invalid session ID format"),
});

/**
 * User registration schema
 */
export const registerSchema = z.object({
    email: z
        .string({
            required_error: "Email is required",
        })
        .email("Invalid email format")
        .toLowerCase()
        .trim(),

    username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username must not exceed 30 characters")
        .regex(
            /^[a-zA-Z0-9_]+$/,
            "Username can only contain letters, numbers, and underscores"
        )
        .trim()
        .optional(),

    password: z
        .string({
            required_error: "Password is required",
        })
        .min(8, "Password must be at least 8 characters")
        .max(128, "Password must not exceed 128 characters")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            "Password must contain at least one uppercase letter, one lowercase letter, and one number"
        ),

    firstName: z
        .string({
            required_error: "First name is required",
        })
        .min(1, "First name cannot be empty")
        .max(50, "First name must not exceed 50 characters")
        .trim(),

    lastName: z
        .string()
        .max(50, "Last name must not exceed 50 characters")
        .trim()
        .optional(),

    phone: z
        .string()
        .regex(
            /^\+?[1-9]\d{1,14}$/,
            "Invalid phone number format"
        )
        .optional(),
});

/**
 * Change password schema
 */
export const changePasswordSchema = z.object({
    currentPassword: z
        .string({
            required_error: "Current password is required",
        })
        .min(1, "Current password cannot be empty"),

    newPassword: z
        .string({
            required_error: "New password is required",
        })
        .min(8, "New password must be at least 8 characters")
        .max(128, "New password must not exceed 128 characters")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            "New password must contain at least one uppercase letter, one lowercase letter, and one number"
        ),

    confirmPassword: z
        .string({
            required_error: "Password confirmation is required",
        })
        .min(1, "Password confirmation cannot be empty"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

/**
 * Reset password request schema
 */
export const resetPasswordRequestSchema = z.object({
    email: z
        .string({
            required_error: "Email is required",
        })
        .email("Invalid email format")
        .toLowerCase()
        .trim(),
});

/**
 * Reset password schema
 */
export const resetPasswordSchema = z.object({
    token: z
        .string({
            required_error: "Reset token is required",
        })
        .min(1, "Reset token cannot be empty"),

    newPassword: z
        .string({
            required_error: "New password is required",
        })
        .min(8, "New password must be at least 8 characters")
        .max(128, "New password must not exceed 128 characters")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            "New password must contain at least one uppercase letter, one lowercase letter, and one number"
        ),

    confirmPassword: z
        .string({
            required_error: "Password confirmation is required",
        })
        .min(1, "Password confirmation cannot be empty"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

/**
 * Email verification schema
 */
export const verifyEmailSchema = z.object({
    token: z
        .string({
            required_error: "Verification token is required",
        })
        .min(1, "Verification token cannot be empty"),
});

/**
 * OTP verification schema
 */
export const verifyOtpSchema = z.object({
    email: z
        .string({
            required_error: "Email is required",
        })
        .email("Invalid email format")
        .toLowerCase()
        .trim(),

    otp: z
        .string({
            required_error: "OTP is required",
        })
        .length(6, "OTP must be 6 digits")
        .regex(/^\d{6}$/, "OTP must contain only numbers"),
});

/**
 * Send OTP schema
 */
export const sendOtpSchema = z.object({
    emailOrUsername: z
        .string({
            required_error: "Email or username is required",
        })
        .min(1, "Email or username cannot be empty")
        .trim(),
});

/**
 * MFA enable/disable schema
 */
export const mfaToggleSchema = z.object({
    password: z
        .string({
            required_error: "Password is required for this action",
        })
        .min(1, "Password cannot be empty"),
});

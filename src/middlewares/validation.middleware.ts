import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { logger } from "../utils/logger.utils.ts";
import { sendError } from "../utils/response.utils.ts";

/**
 * Request validation targets
 */
type ValidationTarget = "body" | "query" | "params";

/**
 * Validation Middleware Factory
 * Validates request data against a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param target - Which part of the request to validate (body, query, params)
 * 
 * @example
 * const loginSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * });
 * 
 * router.post('/login', 
 *   validate(loginSchema, 'body'),
 *   controller.login
 * );
 */
export const validate = (
    schema: ZodSchema,
    target: ValidationTarget = "body"
) => {
    return async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            // Get the data to validate based on target
            const dataToValidate = req[target];

            // Validate the data
            const validatedData = await schema.parseAsync(dataToValidate);

            // Replace the original data with validated and sanitized data
            req[target] = validatedData;

            logger.debug("Request validation successful", {
                target,
                path: req.path,
            });

            next();
        } catch (error: any) {
            if (error instanceof ZodError) {
                // Format Zod errors into a user-friendly structure
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message,
                    code: err.code,
                }));

                logger.warn("Request validation failed", {
                    target,
                    path: req.path,
                    ip: req.ip,
                    errors: formattedErrors,
                });

                 sendError(
                    res,
                    "Validation failed. Please check your input.",
                    {
                        errors: formattedErrors,
                    },
                    400
                );
            }

            // Handle unexpected errors
            logger.error("Validation middleware error:", {
                error: error.message,
                stack: error.stack,
                target,
                path: req.path,
            });

             sendError(
                res,
                "An error occurred during validation.",
                null,
                500
            );
        }
    };
};

// /**
//  * Multi-target Validation Middleware
//  * Validates multiple parts of the request at once
//  * 
//  * @param schemas - Object containing schemas for different targets
//  * 
//  * @example
//  * router.get('/users/:userId/posts', 
//  *   validateMultiple({
//  *     params: z.object({ userId: z.string().uuid() }),
//  *     query: z.object({ page: z.string().optional() }),
//  *   }),
//  *   controller.getUserPosts
//  * );
//  */
// export const validateMultiple = (schemas: {
//     body?: ZodSchema;
//     query?: ZodSchema;
//     params?: ZodSchema;
// }) => {
//     return async (
//         req: Request,
//         res: Response,
//         next: NextFunction
//     ): Promise<void> => {
//         try {
//             const errors: any[] = [];

//             // Validate each target
//             for (const [target, schema] of Object.entries(schemas)) {
//                 if (schema) {
//                     try {
//                         const validatedData = await schema.parseAsync(
//                             req[target as ValidationTarget]
//                         );
//                         req[target as ValidationTarget] = validatedData;
//                     } catch (error: any) {
//                         if (error instanceof ZodError) {
//                             error.errors.forEach((err) => {
//                                 errors.push({
//                                     target,
//                                     field: err.path.join("."),
//                                     message: err.message,
//                                     code: err.code,
//                                 });
//                             });
//                         }
//                     }
//                 }
//             }

//             // If there are any errors, return them
//             if (errors.length > 0) {
//                 logger.warn("Multi-target validation failed", {
//                     path: req.path,
//                     ip: req.ip,
//                     errors,
//                 });

//                 return sendError(
//                     res,
//                     "Validation failed. Please check your input.",
//                     { errors },
//                     400
//                 );
//             }

//             logger.debug("Multi-target validation successful", {
//                 path: req.path,
//             });

//             next();
//         } catch (error: any) {
//             logger.error("Multi-target validation middleware error:", {
//                 error: error.message,
//                 stack: error.stack,
//                 path: req.path,
//             });

//             return sendError(
//                 res,
//                 "An error occurred during validation.",
//                 null,
//                 500
//             );
//         }
//     };
// };

// /**
//  * Conditional Validation Middleware
//  * Only validates if a condition is met
//  * 
//  * @param schema - Zod schema to validate against
//  * @param target - Which part of the request to validate
//  * @param condition - Function that returns true if validation should occur
//  * 
//  * @example
//  * router.patch('/users/:userId', 
//  *   conditionalValidate(
//  *     passwordSchema, 
//  *     'body',
//  *     (req) => req.body.password !== undefined
//  *   ),
//  *   controller.updateUser
//  * );
//  */
// export const conditionalValidate = (
//     schema: ZodSchema,
//     target: ValidationTarget = "body",
//     condition: (req: Request) => boolean
// ) => {
//     return async (
//         req: Request,
//         res: Response,
//         next: NextFunction
//     ): Promise<void> => {
//         // Check if validation should occur
//         if (!condition(req)) {
//             return next();
//         }

//         // Use the standard validate middleware
//         return validate(schema, target)(req, res, next);
//     };
// };

// /**
//  * Partial Validation Middleware
//  * Validates only the fields that are present in the request
//  * Useful for PATCH endpoints where not all fields are required
//  * 
//  * @param schema - Zod schema to validate against
//  * @param target - Which part of the request to validate
//  * 
//  * @example
//  * router.patch('/users/:userId', 
//  *   partialValidate(userUpdateSchema, 'body'),
//  *   controller.updateUser
//  * );
//  */
// export const partialValidate = (
//     schema: ZodSchema,
//     target: ValidationTarget = "body"
// ) => {
//     return async (
//         req: Request,
//         res: Response,
//         next: NextFunction
//     ): Promise<void> => {
//         try {
//             const dataToValidate = req[target];

//             // Make all fields optional for partial validation
//             const partialSchema = schema.partial();

//             const validatedData = await partialSchema.parseAsync(dataToValidate);
//             req[target] = validatedData;

//             logger.debug("Partial validation successful", {
//                 target,
//                 path: req.path,
//             });

//             next();
//         } catch (error: any) {
//             if (error instanceof ZodError) {
//                 const formattedErrors = error.errors.map((err) => ({
//                     field: err.path.join("."),
//                     message: err.message,
//                     code: err.code,
//                 }));

//                 logger.warn("Partial validation failed", {
//                     target,
//                     path: req.path,
//                     ip: req.ip,
//                     errors: formattedErrors,
//                 });

//                 return sendError(
//                     res,
//                     "Validation failed. Please check your input.",
//                     { errors: formattedErrors },
//                     400
//                 );
//             }

//             logger.error("Partial validation middleware error:", {
//                 error: error.message,
//                 stack: error.stack,
//                 target,
//                 path: req.path,
//             });

//             return sendError(
//                 res,
//                 "An error occurred during validation.",
//                 null,
//                 500
//             );
//         }
//     };
// };

// /**
//  * File Upload Validation Middleware
//  * Validates file uploads (requires multer or similar)
//  * 
//  * @param options - File validation options
//  */
// export const validateFileUpload = (options: {
//     maxSize?: number; // in bytes
//     allowedMimeTypes?: string[];
//     required?: boolean;
// }) => {
//     const {
//         maxSize = 5 * 1024 * 1024, // 5MB default
//         allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"],
//         required = false,
//     } = options;

//     return (req: Request, res: Response, next: NextFunction): void => {
//         const file = (req as any).file;

//         // Check if file is required
//         if (required && !file) {
//             logger.warn("File upload validation failed: No file provided", {
//                 path: req.path,
//                 ip: req.ip,
//             });

//             return sendError(
//                 res,
//                 "File upload is required.",
//                 null,
//                 400
//             );
//         }

//         // If no file and not required, continue
//         if (!file) {
//             return next();
//         }

//         // Validate file size
//         if (file.size > maxSize) {
//             logger.warn("File upload validation failed: File too large", {
//                 path: req.path,
//                 ip: req.ip,
//                 fileSize: file.size,
//                 maxSize,
//             });

//             return sendError(
//                 res,
//                 `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB.`,
//                 null,
//                 400
//             );
//         }

//         // Validate MIME type
//         if (!allowedMimeTypes.includes(file.mimetype)) {
//             logger.warn("File upload validation failed: Invalid file type", {
//                 path: req.path,
//                 ip: req.ip,
//                 mimeType: file.mimetype,
//                 allowedMimeTypes,
//             });

//             return sendError(
//                 res,
//                 `File type not allowed. Allowed types: ${allowedMimeTypes.join(", ")}`,
//                 null,
//                 400
//             );
//         }

//         logger.debug("File upload validation successful", {
//             path: req.path,
//             fileName: file.originalname,
//             fileSize: file.size,
//             mimeType: file.mimetype,
//         });

//         next();
//     };
// };

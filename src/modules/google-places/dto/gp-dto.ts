import { z } from "zod";

export const AutocompleteQuerySchema = z.object({
    input: z
        .string({
            required_error: "Input is required",
            invalid_type_error: "Input must be a string",
        })
        .min(2, "Input must be at least 2 characters"),

    types: z.string().optional().default("address"),
});

export type AutocompleteQueryDto = z.infer<typeof AutocompleteQuerySchema>;
export const PlaceDetailsParamsSchema = z.object({
    placeId: z
        .string({
            required_error: "Place ID is required",
            invalid_type_error: "Place ID must be a string",
        })
        .min(1, "Place ID is required"),
});

export type PlaceDetailsParamsDto = z.infer<typeof PlaceDetailsParamsSchema>;
export const GeocodeRequestSchema = z.object({
    address: z
        .string({
            required_error: "Address is required",
            invalid_type_error: "Address must be a string",
        })
        .min(3, "Address must be at least 3 characters"),
});

export type GeocodeRequestDto = z.infer<typeof GeocodeRequestSchema>;
export const ReverseGeocodeRequestSchema = z.object({
    latitude: z
        .number({
            required_error: "Latitude is required",
            invalid_type_error: "Latitude must be a number",
        })
        .min(-90, "Latitude must be between -90 and 90")
        .max(90, "Latitude must be between -90 and 90"),

    longitude: z
        .number({
            required_error: "Longitude is required",
            invalid_type_error: "Longitude must be a number",
        })
        .min(-180, "Longitude must be between -180 and 180")
        .max(180, "Longitude must be between -180 and 180"),
});

export type ReverseGeocodeRequestDto = z.infer<
    typeof ReverseGeocodeRequestSchema
>;

import { z } from "zod";

// 1. Primitive Schema (Direct string validation ke liye - Best Performance)
export const shortCodeSchema = z
    .string({
        required_error: "Short code is required",
        invalid_type_error: "Short code must be a string",
    })
    .trim()
    .min(3, "Short code must be at least 3 characters long")
    .max(30, "Short code cannot exceed 30 characters")
    .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Invalid short code format. Only alphanumeric characters, hyphens, and underscores are permitted"
    );

// 2. Object Schema (Next.js route context params ke liye)
export const redirectParamsSchema = z.object({
    code: shortCodeSchema,
});

export type ShortCodeInput = z.infer<typeof shortCodeSchema>;
export type RedirectParamsInput = z.infer<typeof redirectParamsSchema>;
import { z } from "zod";

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

export const redirectParamsSchema = z.object({
    code: shortCodeSchema,
});

export const updateUrlSchema = z.object({
    longUrl: z
        .string()
        .trim()
        .url("Please provide a valid destination URL")
        .refine(
            (url) => url.startsWith("http://") || url.startsWith("https://"),
            "Destination URL must use http or https protocol"
        )
        .optional(),
    expiresAt: z
        .string()
        .datetime({ message: "expiresAt must be a valid ISO 8601 string" })
        .optional()
        .nullable(),
});

export type ShortCodeInput = z.infer<typeof shortCodeSchema>;
export type RedirectParamsInput = z.infer<typeof redirectParamsSchema>;
export type UpdateUrlInput = z.infer<typeof updateUrlSchema>;
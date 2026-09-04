import { z } from "zod";

const CUSTOM_CODE_REGEX = /^[a-zA-Z0-9_-]+$/;

export const ShortenUrlSchema = z.object({
  originalUrl: z
    .string({ required_error: "Original URL is required" })
    .trim()
    .url("Invalid URL format. Must include http:// or https://")
    .max(2048, "URL exceeds maximum length of 2048 characters"),

  customCode: z
    .string()
    .trim()
    .min(4, "Custom code must be at least 4 characters long")
    .max(16, "Custom code cannot exceed 16 characters")
    .regex(
      CUSTOM_CODE_REGEX,
      "Custom code can only contain letters, numbers, hyphens, and underscores"
    )
    .optional(),
});

export type ShortenUrlInput = z.infer<typeof ShortenUrlSchema>;
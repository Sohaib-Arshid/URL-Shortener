import { z } from "zod";

const RESERVED_WORDS = ["api", "login", "register", "dashboard", "admin", "analytics", "health"];
const CUSTOM_CODE_REGEX = /^[a-zA-Z0-9_-]+$/;

export const ShortenUrlSchema = z.object({
  originalUrl: z
    .string({ required_error: "Original URL is required" })
    .trim()
    .url("Invalid URL format")
    .max(2048, "URL exceeds maximum length of 2048 characters")
    .refine((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, { message: "Only HTTP and HTTPS protocols are allowed" })

    .refine((url) => {
      try {
        const parsed = new URL(url);
        const appHost = process.env.NEXT_PUBLIC_APP_HOST || "localhost";
        return !parsed.hostname.includes(appHost);
      } catch {
        return false;
      }
    }, { message: "You cannot shorten links from this domain" }),

  customCode: z
    .string()
    .trim()
    .min(4, "Custom code must be at least 4 characters")
    .max(16, "Custom code cannot exceed 16 characters")
    .regex(CUSTOM_CODE_REGEX, "Only letters, numbers, hyphens, and underscores allowed")
    .refine((code) => !RESERVED_WORDS.includes(code.toLowerCase()), {
      message: "This code is a reserved system keyword. Please choose another.",
    })
    .optional(),

  expiresAt: z
    .string()
    .datetime({ message: "Invalid ISO date string format" })
    .refine((val) => new Date(val).getTime() > Date.now(), {
      message: "Expiration date must be in the future",
    })
    .optional(),
});

export type ShortenUrlInput = z.infer<typeof ShortenUrlSchema>;
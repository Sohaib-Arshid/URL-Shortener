import { NextRequest } from "next/server";
import { requireAuth } from "@/middleware/auth.middleware";
import { ShortenUrlSchema } from "@/schema/urlSchema";
import { createShortUrlService } from "@/services/url.service";
import { rateLimit } from "@/utils/rateLimiter";
import ApiResponse from "@/utils/apiResponse";
import ApiError from "@/utils/apiError";
import asyncHandler from "@/utils/asyncHandler";

export const POST = asyncHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);

  await rateLimit(`shorten:${userId}`, {
    maxRequests: 30,
    windowSeconds: 60,
  });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    throw new ApiError(400, "Malformed or empty JSON request body");
  }

  const parsed = ShortenUrlSchema.parse(rawBody);

  const newUrl = await createShortUrlService({
    userId,
    originalUrl: parsed.originalUrl,
    customCode: parsed.customCode,
    expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
  });

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return ApiResponse.json(
    201,
    {
      id: newUrl.id,
      originalUrl: newUrl.originalUrl,
      shortCode: newUrl.shortCode,
      shortUrl: `${appBaseUrl}/${newUrl.shortCode}`,
      expiresAt: newUrl.expiresAt,
      createdAt: newUrl.createdAt,
    },
    "Short URL created successfully"
  );
});
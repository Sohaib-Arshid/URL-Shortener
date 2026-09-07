import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiError } from "@/utils/apiError";
import { shortCodeSchema } from "@/validators/url.validator";

interface RouteContext {
  params: Promise<{ code: string }>;
}

const DEFAULT_CACHE_TTL_SECONDS = 86400;

export const GET = asyncHandler(
  async (request: NextRequest, context: RouteContext) => {
    const { code } = await context.params;

    const validation = shortCodeSchema.safeParse(code);
    if (!validation.success) {
      throw new ApiError(400, validation.error.issues[0]?.message || "Invalid short code");
    }

    const validCode = validation.data;
    const cacheKey = `url:${validCode}`;

    try {
      const cachedTarget = await redis.get<string>(cacheKey);
      if (cachedTarget) {
        return NextResponse.redirect(cachedTarget, 302);
      }
    } catch (redisErr) {
      console.error(`[REDIS_FAILOVER] Read failed:`, redisErr);
    }

    const record = await db.url.findUnique({
      where: { shortCode: validCode },
      select: {
        longUrl: true,
        expiresAt: true,
      },
    });

    if (!record) {
      throw new ApiError(404, "Short URL not found");
    }

    const now = Date.now();
    if (record.expiresAt && new Date(record.expiresAt).getTime() <= now) {
      throw new ApiError(410, "This short link has expired");
    }

    try {
      const parsedDestination = new URL(record.longUrl);
      if (!["http:", "https:"].includes(parsedDestination.protocol)) {
        throw new Error();
      }
    } catch {
      throw new ApiError(422, "Destination URL is unsafe or malformed");
    }

    void (async () => {
      try {
        let ttl = DEFAULT_CACHE_TTL_SECONDS;
        if (record.expiresAt) {
          const remainingSeconds = Math.floor(
            (new Date(record.expiresAt).getTime() - now) / 1000
          );
          if (remainingSeconds > 0) {
            ttl = Math.min(remainingSeconds, DEFAULT_CACHE_TTL_SECONDS);
          }
        }
        await redis.set(cacheKey, record.longUrl, { ex: ttl });
      } catch (cacheWriteErr) {
        console.error(`[REDIS_FAILOVER] Write failed:`, cacheWriteErr);
      }
    })();

    return NextResponse.redirect(record.longUrl, 302);
  }
);
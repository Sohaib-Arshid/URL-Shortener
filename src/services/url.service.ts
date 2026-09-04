import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import ApiError from "@/utils/apiError";
import { generateShortCode } from "@/utils/crypto";
import { Prisma } from "@prisma/client";

interface CreateUrlParams {
  userId: string;
  originalUrl: string;
  customCode?: string;
  expiresAt?: Date | null;
}

const MAX_COLLISION_RETRIES = 5;
const DEFAULT_URL_CACHE_TTL = 60 * 60 * 24;

function calculateCacheTTL(expiresAt?: Date | null): number {
  if (!expiresAt) {
    return DEFAULT_URL_CACHE_TTL;
  }

  const remainingSeconds = Math.floor(
    (new Date(expiresAt).getTime() - Date.now()) / 1000
  );

  if (remainingSeconds <= 0) {
    throw new ApiError(400, "Expiration date must be in the future.");
  }

  return Math.min(remainingSeconds, DEFAULT_URL_CACHE_TTL);
}

export async function createShortUrlService({
  userId,
  originalUrl,
  customCode,
  expiresAt,
}: CreateUrlParams) {
  const ttlSeconds = calculateCacheTTL(expiresAt);

  if (customCode) {
    const existing = await db.url.findUnique({
      where: { shortCode: customCode },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError(409, "Custom short code is already in use. Try another one.");
    }

    const newUrl = await db.url.create({
      data: {
        longUrl: originalUrl,
        shortCode: customCode,
        userId,
        expiresAt: expiresAt || null,
      },
    });

    await redis.set(`url:${customCode}`, originalUrl, { ex: ttlSeconds });

    return newUrl;
  }

  for (let attempt = 1; attempt <= MAX_COLLISION_RETRIES; attempt++) {
    const shortCode = generateShortCode(7);

    try {
      const newUrl = await db.url.create({
        data: {
          longUrl: originalUrl,
          shortCode,
          userId,
          expiresAt: expiresAt || null,
        },
      });

      await redis.set(`url:${shortCode}`, originalUrl, { ex: ttlSeconds });

      return newUrl;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new ApiError(500, "Unable to generate a unique short code. Please try again.");
}
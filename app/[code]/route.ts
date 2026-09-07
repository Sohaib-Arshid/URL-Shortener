import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiError } from "@/utils/apiError";

interface RouteContext {
    params: Promise<{ code: string }>;
}

const DEFAULT_CACHE_TTL = 60 * 60 * 24;

export const GET = asyncHandler(
    async (request: NextRequest, context: RouteContext) => {
        const { code } = await context.params;

        if (!code) {
            throw new ApiError(400, "Short code is required");
        }

        try {
            const cachedTarget = await redis.get<string>(`url:${code}`);
            if (cachedTarget) {
                return NextResponse.redirect(cachedTarget, 302);
            }
        } catch (error) {
            console.error("[REDIS_READ_FAIL]:", error);
        }

        const record = await db.url.findUnique({
            where: { shortCode: code },
            select: {
                longUrl: true,
                expiresAt: true,
            },
        });

        if (!record) {
            throw new ApiError(404, "Short link not found or invalid");
        }

        if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
            throw new ApiError(410, "This short link has expired");
        }

        try {
            let ttl = DEFAULT_CACHE_TTL;
            if (record.expiresAt) {
                const remainingSeconds = Math.floor(
                    (new Date(record.expiresAt).getTime() - Date.now()) / 1000
                );
                if (remainingSeconds > 0) {
                    ttl = Math.min(remainingSeconds, DEFAULT_CACHE_TTL);
                }
            }

            await redis.set(`url:${code}`, record.longUrl, { ex: ttl });
        } catch (error) {
            console.error("[REDIS_WRITE_FAIL]:", error);
        }

        return NextResponse.redirect(record.longUrl, 302);
    }
);
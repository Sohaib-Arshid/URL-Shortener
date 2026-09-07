import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { asyncHandler } from '@/utils/asyncHandler'
import { ApiError } from '@/utils/apiError'
import { shortCodeSchema } from '@/validators/url.validator'

interface RouteContext {
    params: Promise<{ code: string }>
}

type CachedRedirect = {
    longUrl: string
    expiresAt: string | null
}

const DEFAULT_CACHE_TTL_SECONDS = 24 * 60 * 60

const isSafeDestination = (value: string): boolean => {
    try {
        const destination = new URL(value)
        return ['http:', 'https:'].includes(destination.protocol)
    } catch {
        return false
    }
}

const isCachedRedirect = (value: unknown): value is CachedRedirect => {
    if (!value || typeof value !== 'object') {
        return false
    }

    const cached = value as Record<string, unknown>

    return (
        typeof cached.longUrl === 'string' &&
        (cached.expiresAt === null || typeof cached.expiresAt === 'string')
    )
}

export const GET = asyncHandler(
    async (request: NextRequest, context: RouteContext) => {
        const { code } = await context.params

        const validation = shortCodeSchema.safeParse(code)
        if (!validation.success) {
            throw new ApiError(
                400,
                validation.error.issues[0]?.message || 'Invalid short code'
            )
        }

        const validCode = validation.data
        const cacheKey = `url:redirect:${validCode}`

        try {
            const cachedValue = await redis.get<unknown>(cacheKey)

            if (isCachedRedirect(cachedValue)) {
                const cachedExpiry = cachedValue.expiresAt
                    ? new Date(cachedValue.expiresAt)
                    : null

                const cachedIsExpired =
                    cachedExpiry !== null &&
                    !Number.isNaN(cachedExpiry.getTime()) &&
                    cachedExpiry.getTime() <= Date.now()

                if (!cachedIsExpired && isSafeDestination(cachedValue.longUrl)) {
                    return NextResponse.redirect(cachedValue.longUrl, 302)
                }

                await redis.del(cacheKey)
            }
        } catch (redisError: unknown) {
            console.error('[REDIS_FAILOVER] Cache read failed', redisError)
        }

        const record = await db.url.findUnique({
            where: { shortCode: validCode },
            select: {
                id: true,
                longUrl: true,
                expiresAt: true,
            },
        })

        if (!record) {
            throw new ApiError(404, 'Short URL not found')
        }

        const now = Date.now()
        const expiresAtMillis = record.expiresAt?.getTime() ?? null

        if (expiresAtMillis !== null && expiresAtMillis <= now) {
            throw new ApiError(410, 'This short link has expired')
        }

        if (!isSafeDestination(record.longUrl)) {
            throw new ApiError(422, 'Destination URL is unsafe or malformed')
        }

        const cacheValue: CachedRedirect = {
            longUrl: record.longUrl,
            expiresAt: record.expiresAt?.toISOString() ?? null,
        }

        let ttl = DEFAULT_CACHE_TTL_SECONDS
        if (expiresAtMillis !== null) {
            const remainingSeconds = Math.floor((expiresAtMillis - now) / 1000)
            ttl = Math.max(1, Math.min(remainingSeconds, DEFAULT_CACHE_TTL_SECONDS))
        }

        try {
            await redis.set(cacheKey, cacheValue, { ex: ttl })
        } catch (redisError: unknown) {
            console.error('[REDIS_FAILOVER] Cache write failed', redisError)
        }

        return NextResponse.redirect(record.longUrl, 302)
    }
)
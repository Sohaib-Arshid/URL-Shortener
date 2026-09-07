import { NextRequest, NextResponse, after } from 'next/server'
import crypto from 'node:crypto'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { analyticsQueue, AnalyticsJobPayload } from '@/lib/analyticsQueue'
import { asyncHandler } from '@/utils/asyncHandler'
import { ApiError } from '@/utils/apiError'
import { shortCodeSchema } from '@/validators/url.validator'

export const runtime = 'nodejs'

interface RouteContext {
    params: Promise<{ code: string }>
}

type CachedRedirect = {
    urlId: string
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

const isValidIsoDate = (dateStr: string): boolean => {
    const timestamp = Date.parse(dateStr)
    return !Number.isNaN(timestamp)
}

const isCachedRedirect = (value: unknown): value is CachedRedirect => {
    if (!value || typeof value !== 'object') {
        return false
    }

    const cached = value as Record<string, unknown>

    const isValidTypes =
        typeof cached.urlId === 'string' &&
        typeof cached.longUrl === 'string' &&
        (cached.expiresAt === null || typeof cached.expiresAt === 'string')

    if (!isValidTypes) return false

    if (typeof cached.expiresAt === 'string' && !isValidIsoDate(cached.expiresAt)) {
        return false
    }

    return true
}

const getClientIp = (request: NextRequest): string | null => {
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
        const ips = forwardedFor.split(',').map((ip) => ip.trim())
        return ips[0] || null
    }
    return request.headers.get('x-real-ip')?.trim() || null
}

const enqueueAnalyticsEvent = (urlId: string, request: NextRequest): void => {
    const payload: AnalyticsJobPayload = {
        eventId: crypto.randomUUID(),
        urlId,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        country:
            request.headers.get('cf-ipcountry') ??
            request.headers.get('x-vercel-ip-country'),
        city:
            request.headers.get('cf-ipcity') ??
            request.headers.get('x-vercel-ip-city'),
        clickedAt: new Date().toISOString(),
    }

    after(async () => {
        try {
            await analyticsQueue.add('url-click', payload, {
                jobId: payload.eventId,
            })
        } catch (error: unknown) {
            console.error('[ANALYTICS_QUEUE_ERROR]', error)
        }
    })
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

            if (cachedValue !== null && cachedValue !== undefined) {
                if (isCachedRedirect(cachedValue)) {
                    const cachedExpiry = cachedValue.expiresAt
                        ? new Date(cachedValue.expiresAt)
                        : null

                    const cachedIsExpired =
                        cachedExpiry !== null && cachedExpiry.getTime() <= Date.now()

                    if (!cachedIsExpired && isSafeDestination(cachedValue.longUrl)) {
                        enqueueAnalyticsEvent(cachedValue.urlId, request)
                        return NextResponse.redirect(cachedValue.longUrl, 302)
                    }
                }
                await redis.del(cacheKey)
            }
        } catch (redisError: unknown) {
            console.error('[REDIS_CACHE_READ_ERROR]', redisError)
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
            urlId: record.id,
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
            console.error('[REDIS_CACHE_WRITE_ERROR]', redisError)
        }

        enqueueAnalyticsEvent(record.id, request)

        return NextResponse.redirect(record.longUrl, 302)
    }
)
import { redis } from '@/lib/redis'

type RateLimitResult =
    | {
        allowed: true
        count: number
        remaining: number
        retryAfter: 0
    }
    | {
        allowed: false
        count: number
        remaining: 0
        retryAfter: number
    }
    | {
        allowed: false
        count: 0
        remaining: 0
        retryAfter: 0
        reason: 'unavailable'
    }

const incrementWithExpiryScript = `
local count = redis.call('INCR', KEYS[1])

if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end

local ttl = redis.call('TTL', KEYS[1])
return { count, ttl }
`

export const rateLimit = async (
    key: string,
    limit: number,
    windowInSeconds: number
): Promise<RateLimitResult> => {
    if (!key.trim()) {
        throw new Error('Rate-limit key is required')
    }

    if (!Number.isInteger(limit) || limit <= 0) {
        throw new Error('Rate-limit limit must be a positive integer')
    }

    if (!Number.isInteger(windowInSeconds) || windowInSeconds <= 0) {
        throw new Error('Rate-limit window must be a positive integer')
    }

    try {
        const result = (await redis.eval(
            incrementWithExpiryScript,
            [key],
            [String(windowInSeconds)]
        )) as [number, number]

        const count = Number(result[0])
        const ttl = Number(result[1])

        if (count > limit) {
            return {
                allowed: false,
                count,
                remaining: 0,
                retryAfter: Math.max(ttl, 0),
            }
        }

        return {
            allowed: true,
            count,
            remaining: Math.max(limit - count, 0),
            retryAfter: 0,
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown Redis error'

        process.stderr.write(
            JSON.stringify({
                level: 'error',
                timestamp: new Date().toISOString(),
                action: 'rateLimit',
                key,
                error: message,
            }) + '\n'
        )

        return {
            allowed: false,
            count: 0,
            remaining: 0,
            retryAfter: 0,
            reason: 'unavailable',
        }
    }
}

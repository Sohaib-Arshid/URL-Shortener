import { redis } from '@/lib/redis'

export const getCache = async <T = unknown>(key: string): Promise<T | null> => {
    try {
        const data = await redis.get<T>(key)
        return data ?? null
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown Redis error'
        process.stderr.write(
            JSON.stringify({
                level: 'error',
                timestamp: new Date().toISOString(),
                action: 'getCache',
                key,
                error: message,
            }) + '\n'
        )
        return null
    }
}

export const setCache = async <T = unknown>(
    key: string,
    value: T,
    ttlInSeconds: number = 3600
): Promise<boolean> => {
    try {
        await redis.set(key, value, { ex: ttlInSeconds })
        return true
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown Redis error'
        process.stderr.write(
            JSON.stringify({
                level: 'error',
                timestamp: new Date().toISOString(),
                action: 'setCache',
                key,
                error: message,
            }) + '\n'
        )
        return false
    }
}

export const deleteCache = async (key: string): Promise<boolean> => {
    try {
        await redis.del(key)
        return true
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown Redis error'
        process.stderr.write(
            JSON.stringify({
                level: 'error',
                timestamp: new Date().toISOString(),
                action: 'deleteCache',
                key,
                error: message,
            }) + '\n'
        )
        return false
    }
}
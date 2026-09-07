import { Queue } from 'bullmq'
import Redis from 'ioredis'

export const ANALYTICS_QUEUE_NAME = 'analytics-queue'
export const ANALYTICS_DLQ_NAME = 'analytics-dlq'

const getRedisUrl = (): string => {
    const url = process.env.UPSTASH_REDIS_REST_URL
    if (!url) {
        throw new Error('[BULLMQ_CONFIG_ERROR] REDIS_URL environment variable is missing.')
    }
    return url
}

export const bullmqRedisConnection = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
})

export interface AnalyticsJobPayload {
    eventId: string
    urlId: string
    ipAddress: string | null
    userAgent: string | null
    referer: string | null
    country: string | null
    city: string | null
    clickedAt: string
}

export const analyticsQueue = new Queue<AnalyticsJobPayload>(ANALYTICS_QUEUE_NAME, {
    connection: bullmqRedisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: 1000,
        removeOnFail: false,
    },
})

// Dead Letter Queue (DLQ)
export const analyticsDLQ = new Queue(ANALYTICS_DLQ_NAME, {
    connection: bullmqRedisConnection,
})
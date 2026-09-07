import 'dotenv/config'
import { redis } from '@/lib/redis'
import { db } from '@/lib/db'
import {
    ANALYTICS_QUEUE_KEY,
    ANALYTICS_DLQ_KEY,
    AnalyticsJobPayload,
} from '@/lib/analyticsQueue'
import { analyticsJobSchema } from '@/validators/analyticsJob.validator'
import { AnalyticsService } from '@/services/analytics.service'

const BATCH_SIZE = 10
const POLL_INTERVAL_MS = 1000

let isRunning = true

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const processSingleJob = async (rawItem: unknown): Promise<void> => {
    let parsedPayload: AnalyticsJobPayload

    try {
        parsedPayload =
            typeof rawItem === 'string' ? JSON.parse(rawItem) : (rawItem as AnalyticsJobPayload)
    } catch {
        console.error('[WORKER_CORRUPT_JSON] Could not parse queue item:', rawItem)
        await redis.lpush(ANALYTICS_DLQ_KEY, JSON.stringify({ raw: rawItem, error: 'JSON_PARSE_FAILED' }))
        return
    }

    const validation = analyticsJobSchema.safeParse(parsedPayload)
    if (!validation.success) {
        console.error('[WORKER_VALIDATION_ERROR] Malformed job:', validation.error.format())
        await redis.lpush(
            ANALYTICS_DLQ_KEY,
            JSON.stringify({ payload: parsedPayload, error: 'VALIDATION_FAILED' })
        )
        return
    }

    try {
        const result = await AnalyticsService.recordClick(validation.data)
        if (result.status === 'skipped') {
            console.log(`[IDEMPOTENT_SKIP] Event ${validation.data.eventId} already recorded.`)
        } else {
            console.log(`[WORKER_SUCCESS] Processed click for URL: ${validation.data.urlId}`)
        }
    } catch (error: unknown) {
        console.error(`[WORKER_DB_ERROR] Failed to write event ${validation.data.eventId}:`, error)
        await redis.lpush(
            ANALYTICS_DLQ_KEY,
            JSON.stringify({
                payload: validation.data,
                error: error instanceof Error ? error.message : 'DB_INSERT_FAILED',
                failedAt: new Date().toISOString(),
            })
        )
    }
}

export const startWorker = async () => {
    console.log('[UPSTASH_WORKER] Started listening on Upstash Redis queue...')

    while (isRunning) {
        try {
            // Upstash Redis se right side se items pop karein
            const items = await redis.rpop<string[] | string>(ANALYTICS_QUEUE_KEY, BATCH_SIZE)

            if (!items || (Array.isArray(items) && items.length === 0)) {
                await sleep(POLL_INTERVAL_MS)
                continue
            }

            const batch = Array.isArray(items) ? items : [items]

            // Parallel batch processing
            await Promise.allSettled(batch.map((item) => processSingleJob(item)))
        } catch (pollError: unknown) {
            console.error('[WORKER_POLL_ERROR] Error fetching from Upstash:', pollError)
            await sleep(2000)
        }
    }

    console.log('[UPSTASH_WORKER] Stopped gracefully.')
}

const handleShutdown = async (signal: string) => {
    console.log(`\n[WORKER_SHUTDOWN] Signal ${signal} received. Cleaning up...`)
    isRunning = false
    await db.$disconnect()
    process.exit(0)
}

process.on('SIGINT', () => handleShutdown('SIGINT'))
process.on('SIGTERM', () => handleShutdown('SIGTERM'))

startWorker()
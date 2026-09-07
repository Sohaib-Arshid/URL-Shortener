import { Worker, Job, UnrecoverableError } from 'bullmq'
import { db } from '@/lib/db'
import {
    ANALYTICS_QUEUE_NAME,
    ANALYTICS_DLQ_NAME,
    bullmqRedisConnection,
    analyticsDLQ,
} from '@/lib/analyticsQueue'
import type { AnalyticsJobPayload } from '@/lib/analyticsQueue'
import { analyticsJobSchema } from '@/validators/analyticsJob.validator'
import { AnalyticsService } from '@/services/analytics.service'

export const analyticsWorker = new Worker<AnalyticsJobPayload>(
    ANALYTICS_QUEUE_NAME,
    async (job: Job<AnalyticsJobPayload>) => {
        const parseResult = analyticsJobSchema.safeParse(job.data)
        if (!parseResult.success) {
            throw new UnrecoverableError(
                `MALFORMED_JOB_PAYLOAD: ${JSON.stringify(parseResult.error.format())}`
            )
        }

        try {
            return await AnalyticsService.recordClick(parseResult.data)
        } catch (error: unknown) {
            if (error instanceof Error && error.message.startsWith('ORPHAN_URL_ABORT')) {
                throw new UnrecoverableError(error.message)
            }
            throw error
        }
    },
    {
        connection: bullmqRedisConnection,
        concurrency: 10,
    }
)

analyticsWorker.on('completed', (job: Job) => {
    console.log(`[WORKER_COMPLETED] Job: ${job.id} | Event: ${job.data?.eventId}`)
})

analyticsWorker.on('failed', async (job: Job | undefined, err: Error) => {
    if (!job) {
        console.error(`[WORKER_FAILED] Unknown job failure: ${err.message}`)
        return
    }

    console.error(
        `[WORKER_ATTEMPT_FAILED] Job ${job.id} (Attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`
    )

    const isExhausted = job.attemptsMade >= (job.opts.attempts || 3)
    const isUnrecoverable = err instanceof UnrecoverableError

    if (isExhausted || isUnrecoverable) {
        console.error(`[ROUTING_TO_DLQ] Job ${job.id} failed permanently. Sending to ${ANALYTICS_DLQ_NAME}...`)

        try {
            await analyticsDLQ.add(
                'failed-click-event',
                {
                    originalJobId: job.id,
                    payload: job.data,
                    failedReason: err.message,
                    stacktrace: job.stacktrace,
                    failedAt: new Date().toISOString(),
                    totalAttempts: job.attemptsMade,
                },
                {
                    jobId: `dlq:${job.id}`,
                    removeOnComplete: false,
                }
            )
            console.log(`[DLQ_SAVED] Job ${job.id} isolated in DLQ with ID dlq:${job.id}`)
        } catch (dlqError: unknown) {
            console.error(`[CRITICAL_DLQ_FAILURE] Could not isolate job ${job.id} in DLQ:`, dlqError)
        }
    }
})

analyticsWorker.on('error', (err: Error) => {
    console.error('[WORKER_FATAL_CONNECTION_ERROR]', err)
})

let isShuttingDown = false

const shutdownWorker = async (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true

    console.log(`\n[WORKER_SHUTDOWN] Received ${signal}. Shutting down cleanly...`)
    await analyticsWorker.close()
    await bullmqRedisConnection.quit()
    await db.$disconnect()
    console.log('[WORKER_SHUTDOWN] Clean exit complete.')
    process.exit(0)
}

process.on('SIGINT', () => shutdownWorker('SIGINT'))
process.on('SIGTERM', () => shutdownWorker('SIGTERM'))
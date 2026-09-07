import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ValidatedAnalyticsJob } from '@/validators/analyticsJob.validator'
import { parseUserAgent } from '@/utils/userAgent.util'

export class AnalyticsService {
    static async recordClick(data: ValidatedAnalyticsJob) {
        const {
            eventId,
            urlId,
            ipAddress,
            userAgent,
            referer,
            country,
            city,
            clickedAt,
        } = data

        // 1. Fast State Check
        const alreadyProcessed = await db.analytics.findUnique({
            where: { id: eventId },
            select: { id: true },
        })

        if (alreadyProcessed) {
            return { status: 'skipped', reason: 'already_processed', eventId }
        }

        const { device, browser, os } = parseUserAgent(userAgent)
        const parsedClickedAt = new Date(clickedAt)

        // 2. Atomic Transaction
        try {
            await db.$transaction(
                async (tx) => {
                    const parentUrl = await tx.url.findUnique({
                        where: { id: urlId },
                        select: { id: true },
                    })

                    if (!parentUrl) {
                        throw new Error(`ORPHAN_URL_ABORT: URL ${urlId} does not exist.`)
                    }

                    await tx.analytics.create({
                        data: {
                            id: eventId,
                            urlId,
                            country: country || null,
                            city: city || null,
                            device,
                            browser,
                            os,
                            referer: referer || null,
                            ipAddress: ipAddress || null,
                            clickedAt: parsedClickedAt,
                        },
                    })

                    await tx.url.update({
                        where: { id: urlId },
                        data: {
                            clickCount: { increment: 1 },
                        },
                    })
                },
                {
                    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
                    timeout: 10000,
                }
            )

            return { status: 'success', eventId }
        } catch (dbError: unknown) {
            if (
                dbError instanceof Prisma.PrismaClientKnownRequestError &&
                dbError.code === 'P2002'
            ) {
                return { status: 'skipped', reason: 'duplicate_race_condition', eventId }
            }

            throw dbError
        }
    }
}
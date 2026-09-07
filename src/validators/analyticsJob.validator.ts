import { z } from 'zod'

export const analyticsJobSchema = z.object({
    eventId: z.string().uuid(),
    urlId: z.string().min(1),
    ipAddress: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
    referer: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    clickedAt: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
        message: 'Invalid ISO timestamp',
    }),
})

export type ValidatedAnalyticsJob = z.infer<typeof analyticsJobSchema>
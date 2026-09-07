export const ANALYTICS_QUEUE_KEY = 'queue:analytics:events'
export const ANALYTICS_DLQ_KEY = 'queue:analytics:dlq'

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
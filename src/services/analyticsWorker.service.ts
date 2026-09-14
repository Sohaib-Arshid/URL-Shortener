import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { ANALYTICS_QUEUE_KEY, AnalyticsJobPayload } from '@/lib/analyticsQueue'

interface ParsedUserAgent {
    browser: string
    os: string
    device: string
}

const parseUserAgent = (userAgentString: string | null): ParsedUserAgent => {
    if (!userAgentString) {
        return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' }
    }

    const ua = userAgentString.toLowerCase()

    let device = 'Desktop'
    if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
        device = /ipad|tablet/i.test(ua) ? 'Tablet' : 'Mobile'
    }

    let browser = 'Other'
    if (ua.includes('edg/')) browser = 'Edge'
    else if (ua.includes('chrome/')) browser = 'Chrome'
    else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari'
    else if (ua.includes('firefox/')) browser = 'Firefox'

    let os = 'Other'
    if (ua.includes('windows')) os = 'Windows'
    else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS'
    else if (ua.includes('android')) os = 'Android'
    else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) os = 'iOS'
    else if (ua.includes('linux')) os = 'Linux'

    return { browser, os, device }
}

export const processAnalyticsQueue = async (batchSize = 50): Promise<{ processed: number }> => {
    const rawEvents: string[] = []

    for (let i = 0; i < batchSize; i++) {
        const item = await redis.rpop<string>(ANALYTICS_QUEUE_KEY)
        if (!item) break
        rawEvents.push(typeof item === 'string' ? item : JSON.stringify(item))
    }

    if (rawEvents.length === 0) {
        return { processed: 0 }
    }

    const parsedEvents: AnalyticsJobPayload[] = []
    for (const raw of rawEvents) {
        try {
            parsedEvents.push(JSON.parse(raw))
        } catch (err: unknown) {
            console.error('[ANALYTICS_PAYLOAD_PARSE_ERROR]', err)
        }
    }

    if (parsedEvents.length === 0) {
        return { processed: 0 }
    }

    const analyticsRecords = parsedEvents.map((event) => {
        const { browser, os, device } = parseUserAgent(event.userAgent)
        return {
            urlId: event.urlId,
            ipAddress: event.ipAddress,
            country: event.country ?? null,
            city: event.city ?? null,
            referer: event.referer ?? null,
            browser,
            os,
            device,
            clickedAt: new Date(event.clickedAt),
        }
    })

    const urlClickMap = new Map<string, number>()
    for (const event of parsedEvents) {
        const count = urlClickMap.get(event.urlId) ?? 0
        urlClickMap.set(event.urlId, count + 1)
    }

    await db.$transaction([
        db.analytics.createMany({
            data: analyticsRecords,
        }),
        ...Array.from(urlClickMap.entries()).map(([urlId, increment]) =>
            db.url.update({
                where: { id: urlId },
                data: {
                    clickCount: { increment },
                },
            })
        ),
    ])

    return { processed: parsedEvents.length }
}
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { asyncHandler } from '@/utils/asyncHandler'
import { ApiError } from '@/utils/apiError'

interface RouteContext {
    params: Promise<{ id: string }>
}

export const GET = asyncHandler(async (_request: NextRequest, context: RouteContext) => {
    const { id } = await context.params

    const urlRecord = await db.url.findUnique({
        where: { id },
        select: {
            id: true,
            shortCode: true,
            longUrl: true,
            clickCount: true,
            createdAt: true,
        },
    })

    if (!urlRecord) {
        throw new ApiError(404, 'URL resource not found')
    }

    const [countryStats, referrerStats, deviceStats, recentClicks] = await Promise.all([
        db.analytics.groupBy({
            by: ['country'],
            where: { urlId: id },
            _count: { country: true },
            orderBy: {
                _count: {
                    country: 'desc',
                },
            },
            take: 10,
        }),
        db.analytics.groupBy({
            by: ['referer'],
            where: { urlId: id },
            _count: { referer: true },
            orderBy: {
                _count: {
                    referer: 'desc',
                },
            },
            take: 10,
        }),
        db.analytics.groupBy({
            by: ['device'],
            where: { urlId: id },
            _count: { device: true },
            orderBy: {
                _count: {
                    device: 'desc',
                },
            },
            take: 10,
        }),
        db.analytics.findMany({
            where: { urlId: id },
            take: 20,
            orderBy: { clickedAt: 'desc' },
            select: {
                id: true,
                ipAddress: true,
                device: true,
                browser: true,
                os: true,
                country: true,
                city: true,
                referer: true,
                clickedAt: true,
            },
        }),
    ])

    const countries = countryStats.map((item) => ({
        country: item.country || 'Unknown',
        clicks: item._count.country,
    }))

    const referrers = referrerStats.map((item) => ({
        referrer: item.referer || 'Direct',
        clicks: item._count.referer,
    }))

    const devices = deviceStats.map((item) => ({
        device: item.device || 'Unknown',
        clicks: item._count.device,
    }))

    return NextResponse.json({
        success: true,
        statusCode: 200,
        data: {
            url: urlRecord,
            summary: {
                totalClicks: urlRecord.clickCount,
                trackedEvents: recentClicks.length,
            },
            countries,
            referrers,
            devices,
            recentClicks,
        },
    })
})
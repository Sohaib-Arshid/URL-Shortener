import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { asyncHandler } from '@/utils/asyncHandler'
import { ApiError } from '@/utils/apiError'
import { updateUrlSchema } from '@/validators/url.validator'

interface RouteContext {
    params: Promise<{ id: string }>
}

export const GET = asyncHandler(async (_request: NextRequest, context: RouteContext) => {
    const { id } = await context.params

    const record = await db.url.findUnique({
        where: { id },
        select: {
            id: true,
            shortCode: true,
            longUrl: true,
            clickCount: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    if (!record) {
        throw new ApiError(404, 'URL resource not found')
    }

    return NextResponse.json({
        success: true,
        statusCode: 200,
        data: record,
    })
})

export const PATCH = asyncHandler(async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params
    const body = await request.json()

    const validation = updateUrlSchema.safeParse(body)
    if (!validation.success) {
        throw new ApiError(400, validation.error.issues[0]?.message || 'Invalid update payload')
    }

    const existingUrl = await db.url.findUnique({
        where: { id },
        select: { id: true, shortCode: true },
    })

    if (!existingUrl) {
        throw new ApiError(404, 'URL resource not found')
    }

    const { longUrl, expiresAt } = validation.data

    const updatedRecord = await db.url.update({
        where: { id },
        data: {
            ...(longUrl !== undefined && { longUrl }),
            ...(expiresAt !== undefined && {
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            }),
        },
        select: {
            id: true,
            shortCode: true,
            longUrl: true,
            clickCount: true,
            expiresAt: true,
            updatedAt: true,
        },
    })

    try {
        await redis.del(`url:redirect:${existingUrl.shortCode}`)
    } catch (cacheError: unknown) {
        console.error('[CACHE_INVALIDATION_ERROR]', cacheError)
    }

    return NextResponse.json({
        success: true,
        statusCode: 200,
        message: 'URL updated and cache invalidated successfully',
        data: updatedRecord,
    })
})

export const DELETE = asyncHandler(async (_request: NextRequest, context: RouteContext) => {
    const { id } = await context.params

    const existingUrl = await db.url.findUnique({
        where: { id },
        select: { id: true, shortCode: true },
    })

    if (!existingUrl) {
        throw new ApiError(404, 'URL resource not found')
    }

    await db.url.delete({
        where: { id },
    })

    try {
        await redis.del(`url:redirect:${existingUrl.shortCode}`)
    } catch (cacheError: unknown) {
        console.error('[CACHE_DELETE_ERROR]', cacheError)
    }

    return NextResponse.json({
        success: true,
        statusCode: 200,
        message: 'URL deleted and cache removed successfully',
    })
})
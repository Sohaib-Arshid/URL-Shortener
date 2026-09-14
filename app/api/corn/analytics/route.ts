import { NextRequest, NextResponse } from 'next/server'
import { processAnalyticsQueue } from '@/services/analyticsWorker.service'
import { asyncHandler } from '@/utils/asyncHandler'

export const GET = asyncHandler(async (_request: NextRequest) => {
    const result = await processAnalyticsQueue(100)

    return NextResponse.json({
        success: true,
        statusCode: 200,
        message: `Processed ${result.processed} analytics events from Redis queue`,
        data: result,
    })
})
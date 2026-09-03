import { NextRequest, NextResponse } from 'next/server'
import { ApiError } from './apiError'

type RouteHandler<T = any> = (
    req: NextRequest,
    context?: T
) => Promise<NextResponse | Response>

export const asyncHandler = (fn: RouteHandler) => {
    return async (req: NextRequest, context?: any) => {
        try {
            return await fn(req, context)
        } catch (error: any) {
            if (error instanceof ApiError) {
                return ApiError.json(error.statusCode, error.message, error.errors)
            }

            return ApiError.json(
                500,
                error?.message || 'Internal Server Error',
                []
            )
        }
    }
}

export default asyncHandler
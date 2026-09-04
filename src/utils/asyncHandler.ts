import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
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
            if (error instanceof ZodError) {
                const primaryMessage = error.issues[0]?.message || 'Validation error'
                const formattedErrors = error.issues.map((issue) => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                }))

                return ApiError.json(400, primaryMessage, formattedErrors)
            }

            if (error instanceof SyntaxError) {
                return ApiError.json(400, 'Invalid JSON payload format', [])
            }

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
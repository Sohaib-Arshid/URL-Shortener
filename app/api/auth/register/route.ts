import { NextRequest } from 'next/server'
import { RegisterSchema } from '@/schema/authSchema'
import { rateLimit } from '@/utils/rateLimiter'
import { registerUser } from '@/services/auth.service'
import ApiError from '@/utils/apiError'
import ApiResponse from '@/utils/apiResponse'

const REGISTER_LIMIT = 5
const REGISTER_WINDOW_SECONDS = 15 * 60

const getClientIp = (request: NextRequest): string => {
  const forwardedFor = request.headers.get('x-forwarded-for')

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return request.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request)
    const rateLimitKey = `rate-limit:register:${clientIp}`

    const rateLimitResult = await rateLimit(
      rateLimitKey,
      REGISTER_LIMIT,
      REGISTER_WINDOW_SECONDS
    )

    if (!rateLimitResult.allowed) {
      if ('reason' in rateLimitResult && rateLimitResult.reason === 'unavailable') {
        return ApiError.json(
          503,
          'Registration is temporarily unavailable. Please try again later.'
        )
      }

      return ApiError.json(
        429,
        'Too many registration attempts. Please try again later.'
      )
    }

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return ApiError.json(400, 'Request body must contain valid JSON')
    }

    const parsed = RegisterSchema.safeParse(body)

    if (!parsed.success) {
      return ApiError.json(
        400,
        'Invalid registration data',
        parsed.error.issues
      )
    }

    const user = await registerUser(parsed.data)

    return ApiResponse.json(201, user, 'Registration completed successfully')
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return ApiError.json(error.statusCode, error.message, error.errors)
    }

    process.stderr.write(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        action: 'registerRoute',
        error: error instanceof Error ? error.message : 'Unknown error',
      }) + '\n'
    )

    return ApiError.json(500, 'Internal Server Error')
  }
}

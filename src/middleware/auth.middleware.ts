import { NextRequest } from 'next/server'
import ApiError from '@/utils/apiError'
import { verifyToken } from '@/utils/jwt'

type AuthenticatedUser = {
  userId: string
}

export function requireAuth(request: NextRequest): AuthenticatedUser {
  const authorizationHeader = request.headers.get('authorization')

  if (!authorizationHeader) {
    throw new ApiError(401, 'Authentication required')
  }

  const parts = authorizationHeader.trim().split(/\s+/)

  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new ApiError(401, 'Invalid authorization header')
  }

  const accessToken = parts[1]

  if (!accessToken) {
    throw new ApiError(401, 'Access token is missing')
  }

  try {
    const payload = verifyToken(accessToken, 'access')

    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new ApiError(401, 'Invalid access token')
    }

    return {
      userId: payload.sub,
    }
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(401, 'Invalid or expired access token')
  }
}

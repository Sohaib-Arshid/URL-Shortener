import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import { ApiError } from './apiError'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is missing in .env')
}

export interface UserJwtPayload extends JwtPayload {
  userId: string
}

export const generateToken = (
  userId: string,
  expiresIn: string | number = '1d'
): string => {
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  }

  return jwt.sign({ userId }, JWT_SECRET, options)
}

export const verifyToken = (token: string): UserJwtPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserJwtPayload
    return decoded
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token has expired, please log in again')
    }
    throw new ApiError(401, 'Invalid authentication token')
  }
}
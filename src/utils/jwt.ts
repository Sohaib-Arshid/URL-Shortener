import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import ApiError from "@/utils/apiError";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error("JWT secrets are missing in environment variables.");
}

export type TokenType = "access" | "refresh";

export interface TokenPayload extends JwtPayload {
  sub: string;
  type: TokenType;
}

export function generateToken(
  userId: string,
  type: TokenType,
  expiresIn: SignOptions["expiresIn"]
): string {
  const secret = type === "access" ? JWT_ACCESS_SECRET : JWT_REFRESH_SECRET;

  return jwt.sign(
    { sub: userId, type },
    secret as string,
    { expiresIn }
  );
}

export function verifyToken(token: string, type: TokenType): TokenPayload {
  const secret = type === "access" ? JWT_ACCESS_SECRET : JWT_REFRESH_SECRET;

  try {
    const decoded = jwt.verify(token, secret as string) as TokenPayload;
    if (decoded.type !== type) {
      throw new ApiError(401, "Invalid token type");
    }
    return decoded;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Token has expired");
    }
    throw new ApiError(401, "Invalid or malformed token");
  }
}
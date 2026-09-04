import { NextRequest } from "next/server";
import ApiError from "@/utils/apiError";
import { verifyToken } from "@/utils/jwt";

export type AuthenticatedUser = {
  userId: string;
};

export function requireAuth(request: NextRequest): AuthenticatedUser {
  let accessToken: string | undefined;

  const authorizationHeader = request.headers.get("authorization");

  if (authorizationHeader) {
    const parts = authorizationHeader.trim().split(/\s+/);

    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      throw new ApiError(
        401,
        "Invalid authorization header format. Expected: Bearer <token>"
      );
    }

    accessToken = parts[1];
  }

  if (!accessToken) {
    accessToken = request.cookies.get("accessToken")?.value;
  }

  if (!accessToken) {
    throw new ApiError(401, "Authentication required. Please log in.");
  }

  try {
    const payload = verifyToken(accessToken, "access");

    if (!payload.sub || typeof payload.sub !== "string") {
      throw new ApiError(401, "Invalid access token payload");
    }

    return {
      userId: payload.sub,
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, "Invalid or expired access token");
  }
}
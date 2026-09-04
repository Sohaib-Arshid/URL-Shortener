import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { LoginSchema } from "@/schema/authSchema";
import { rateLimit } from "@/utils/rateLimiter";
import { login } from "@/services/auth.service";
import ApiError from "@/utils/apiError";
import ApiResponse from "@/utils/apiResponse";
import asyncHandler from "@/utils/asyncHandler";

const LOGIN_LIMIT = 8;
const LOGIN_WINDOW_SECONDS = 15 * 60;

const getClientIp = (request: NextRequest): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
};

export const POST = asyncHandler(async (request: NextRequest) => {
  const clientIp = getClientIp(request);
  const rateLimitKey = `rate-limit:login:${clientIp}`;

  const rateLimitResult = await rateLimit(
    rateLimitKey,
    LOGIN_LIMIT,
    LOGIN_WINDOW_SECONDS
  );

  if (!rateLimitResult.allowed) {
    if (
      "reason" in rateLimitResult &&
      rateLimitResult.reason === "unavailable"
    ) {
      throw new ApiError(
        503,
        "Authentication service is temporarily unavailable. Please try again later."
      );
    }

    throw new ApiError(
      429,
      "Too many login attempts. Please try again later."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Request body must contain valid JSON");
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "Invalid login credentials format",
      parsed.error.issues
    );
  }

  const { user, accessToken, refreshToken } = await login(parsed.data);

  const cookieStore = await cookies();

  cookieStore.set("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });

  cookieStore.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return ApiResponse.json(200, { user }, "Login successful");
});
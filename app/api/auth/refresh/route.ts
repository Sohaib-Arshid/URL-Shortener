import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { refreshAccessToken } from "@/services/auth.service";
import ApiError from "@/utils/apiError";
import ApiResponse from "@/utils/apiResponse";
import asyncHandler from "@/utils/asyncHandler";

export const POST = asyncHandler(async (request: NextRequest) => {
    const cookieStore = await cookies();
    const rawRefreshToken =
        cookieStore.get("refreshToken")?.value ||
        request.headers.get("x-refresh-token");

    if (!rawRefreshToken) {
        throw new ApiError(401, "Refresh token not provided");
    }

    const { accessToken, refreshToken } = await refreshAccessToken(rawRefreshToken);

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

    return ApiResponse.json(200, null, "Token refreshed successfully");
});
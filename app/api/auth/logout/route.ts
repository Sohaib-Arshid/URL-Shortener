import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { logoutUser } from "@/services/auth.service";
import ApiResponse from "@/utils/apiResponse";
import asyncHandler from "@/utils/asyncHandler";

export const POST = asyncHandler(async (_request: NextRequest) => {
  const cookieStore = await cookies();
  const rawRefreshToken = cookieStore.get("refreshToken")?.value;

  if (rawRefreshToken) {
    await logoutUser(rawRefreshToken);
  }

  cookieStore.set("accessToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  cookieStore.set("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return ApiResponse.json(200, null, "Logged out successfully");
});
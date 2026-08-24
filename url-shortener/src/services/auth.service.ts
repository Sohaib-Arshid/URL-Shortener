import ApiError from "@/utils/apiError";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db"
import type { RegisterInput } from "@/utils/authSchema";
import ApiResponse from "@/utils/apiResponse";

export async function registerUser(input: RegisterInput) {

    const email = input.email.trim().toLowerCase();

    const existingUser = await db.user.findUnique({
        where: {
            email,
        },
    })

    if (existingUser) {
        throw new ApiError(409, "If the account can be registered, we will continue with the next step.")
    }

    const passwordHash = await bcrypt.hash(input.password, 10)

    const user = await db.user.create({
        data: {
            name: input.name,
            email,
            passwordHash
        }
    })

    const { passwordHash: _, ...safeUser } = user

    return new ApiResponse(201, safeUser, "user are created successfully")
}
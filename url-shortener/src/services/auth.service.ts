import ApiError from "@/utils/apiError";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db"
import type { RegisterInput } from "@/utils/authSchema";
import { Prisma } from '@prisma/client'
import type { LoginInput } from "@/utils/authSchema";
import { generateToken } from "@/utils/jwt";

export async function registerUser(input: RegisterInput) {

    const name = input.name.trim();
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

    let user

    try {
        user = await db.user.create({
            data: {
                name,
                email,
                passwordHash,
            },
        })
    } catch (error: unknown) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            throw new ApiError(
                409,
                'If the account can be registered, we will continue with the next step.'
            )
        }

        throw error
    }

    const { passwordHash: _, ...safeUser } = user

    return safeUser
}

export async function login(input: LoginInput) {
    const email = input.email.trim().toLowerCase()

    const user = await db.user.findUnique({
        where: {
            email,
        },
    })

    if (!user) {
        throw new ApiError(401, "invalid cradential")
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash)

    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid cradential')
    }

    const accessToken = generateToken(user.id, '15m')

    const refreshToken = generateToken(user.id, '7d')

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
        },
        accessToken,
        refreshToken,
    }
}
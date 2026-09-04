import { z } from 'zod'

export const RegisterSchema = z.object({
    name: z
        .string({
            required_error: 'Name is required',
        })
        .trim()
        .min(2, { message: 'Name must be at least 2 characters long' })
        .max(50, { message: 'Name must not exceed 50 characters' }),

    email: z
        .string({
            required_error: 'Email is required',
        })
        .trim()
        .email({ message: 'Invalid email address format' }),

    password: z
        .string({
            required_error: 'Password is required',
        })
        .min(8, { message: 'Password must be at least 8 characters long' }),
})

export const LoginSchema = z.object({
    email: z
        .string({
            required_error: 'Email is required',
        })
        .trim()
        .email({ message: 'Invalid email address format' }),

    password: z
        .string({
            required_error: 'Password is required',
        })
        .min(8, { message: 'Password must be at least 8 characters long' }),
})


export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
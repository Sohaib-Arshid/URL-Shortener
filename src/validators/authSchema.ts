import { z } from 'zod'

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/

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
    .toLowerCase() 
    .email({ message: 'Invalid email address format' })
    .max(255, { message: 'Email must not exceed 255 characters' }),

  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(72, { message: 'Password must not exceed 72 characters' })
    .regex(
      PASSWORD_REGEX,
      { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' }
    ),
})

export const LoginSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required',
    })
    .trim()
    .toLowerCase()
    .email({ message: 'Invalid email address format' }),

  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(1, { message: 'Password is required' }),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
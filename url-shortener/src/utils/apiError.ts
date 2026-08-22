import { NextResponse } from 'next/server'

export class ApiError extends Error {
    public readonly statusCode: number
    public readonly success: boolean
    public readonly errors: unknown[]

    constructor(
        statusCode: number,
        message: string = 'Something went wrong',
        errors: unknown[] = [],
        stack: string = ''
    ) {
        super(message)
        this.statusCode = statusCode
        this.success = false
        this.errors = errors

        if (stack) {
            this.stack = stack
        } else {
            Error.captureStackTrace(this, this.constructor)
        }
    }

    static json(
        statusCode: number,
        message: string = 'Something went wrong',
        errors: unknown[] = []
    ) {
        return NextResponse.json(
            {
                success: false,
                statusCode,
                message,
                errors,
            },
            { status: statusCode }
        )
    }
}

export default ApiError
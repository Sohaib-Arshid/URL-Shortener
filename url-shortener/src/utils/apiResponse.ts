import { NextResponse } from 'next/server'

export class ApiResponse<T = unknown> {
  public readonly success: boolean
  public readonly statusCode: number
  public readonly message: string
  public readonly data?: T

  constructor(statusCode: number, data?: T, message: string = 'Success') {
    this.statusCode = statusCode
    this.data = data
    this.message = message
    this.success = statusCode < 400
  }

  static json<T>(statusCode: number, data?: T, message: string = 'Success') {
    return NextResponse.json(
      new ApiResponse(statusCode, data, message),
      { status: statusCode }
    )
  }
}

export default ApiResponse
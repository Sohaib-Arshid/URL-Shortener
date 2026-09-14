import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { asyncHandler } from '@/utils/asyncHandler'
import { Prisma } from '@prisma/client'

export const GET = asyncHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)))
  const search = searchParams.get('search')?.trim() || ''

  const skip = (page - 1) * limit

  const where: Prisma.UrlWhereInput = search
    ? {
      OR: [
        { shortCode: { contains: search } },
        { longUrl: { contains: search } },
      ],
    }
    : {}

  const [urls, totalCount] = await Promise.all([
    db.url.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        shortCode: true,
        longUrl: true,
        clickCount: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.url.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / limit)

  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: {
      items: urls,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  })
})
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma'

const IngestionSchema = z.object({
  companyName: z.string().min(1).transform(val => val.trim()),
  rawTitle: z.string().min(1).transform(val => val.trim()),
  rawLevel: z.string().min(1).transform(val => val.trim()),
  role: z.string().min(1).transform(val => val.trim()),
  location: z.string().min(1).transform(val => val.trim().toLowerCase()),
  baseSalary: z.number().positive(),
  stockGrant: z.number().min(0).optional().default(0),
  bonus: z.number().min(0).optional().default(0),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = IngestionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation Failed', details: validation.error.flatten() }, { status: 400 })
    }

    const data = validation.data

    let company = await prisma.company.findFirst({
      where: {
        OR: [
          { name: { equals: data.companyName, mode: 'insensitive' } },
          { aliases: { has: data.companyName.toLowerCase() } }
        ]
      }
    })

    if (!company) {
      company = await prisma.company.create({
        data: { name: data.companyName, aliases: [data.companyName.toLowerCase()] }
      })
    }

    const totalComp = data.baseSalary + data.stockGrant + data.bonus

    const newSalary = await prisma.salary.create({
      data: {
        companyId: company.id,
        rawTitle: data.rawTitle,
        rawLevel: data.rawLevel,
        normalizedRole: data.role,
        location: data.location,
        baseSalary: data.baseSalary,
        stockGrant: data.stockGrant,
        bonus: data.bonus,
        totalComp: totalComp
      }
    })

    return NextResponse.json({ success: true, recordId: newSalary.id, calculatedTotalComp: totalComp }, { status: 201 })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const role = searchParams.get('role')
    const location = searchParams.get('location')
    const company = searchParams.get('company')
    const level = searchParams.get('level')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Build filters dynamically based on what was provided
    const where: any = {}

    if (role) {
      where.normalizedRole = { contains: role, mode: 'insensitive' }
    }
    if (location) {
      where.location = { contains: location.toLowerCase() }
    }
    if (level) {
      where.rawLevel = { equals: level, mode: 'insensitive' }
    }
    if (company) {
      where.company = {
        name: { contains: company, mode: 'insensitive' }
      }
    }

    // Run both queries simultaneously for efficiency
    const [records, total] = await Promise.all([
      prisma.salary.findMany({
        where,
        skip,
        take: limit,
        include: { company: { select: { name: true } } },
        orderBy: { totalComp: 'desc' }
      }),
      prisma.salary.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: records.map(r => ({
        id: r.id,
        company: r.company.name,
        role: r.normalizedRole,
        level: r.rawLevel,
        location: r.location,
        baseSalary: Number(r.baseSalary),
        stockGrant: Number(r.stockGrant),
        bonus: Number(r.bonus),
        totalComp: Number(r.totalComp),
        submittedAt: r.createdAt
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Filter Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const location = searchParams.get('location')
    const company = searchParams.get('company')

    const where: any = {}
    if (role) where.normalizedRole = { contains: role, mode: 'insensitive' }
    if (location) where.location = { contains: location.toLowerCase() }
    if (company) where.company = { name: { contains: company, mode: 'insensitive' } }

    const records = await prisma.salary.findMany({
      where,
      select: {
        totalComp: true,
        baseSalary: true,
        stockGrant: true,
        bonus: true
      }
    })

    if (records.length === 0) {
      return NextResponse.json({ error: 'No records found for given filters' }, { status: 404 })
    }

    const totals = records.map(r => Number(r.totalComp)).sort((a, b) => a - b)
    const base = records.map(r => Number(r.baseSalary))

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    const median = (arr: number[]) => {
      const mid = Math.floor(arr.length / 2)
      return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
    }

    return NextResponse.json({
      success: true,
      count: records.length,
      totalCompensation: {
        average: Math.round(avg(totals)),
        median: Math.round(median(totals)),
        min: totals[0],
        max: totals[totals.length - 1],
        p10: totals[Math.floor(totals.length * 0.1)],
        p90: totals[Math.floor(totals.length * 0.9)]
      },
      baseSalary: {
        average: Math.round(avg(base)),
        min: Math.min(...base),
        max: Math.max(...base)
      }
    })

  } catch (error) {
    console.error('Stats Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
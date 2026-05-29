import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companiesParam = searchParams.get('companies')
    const level = searchParams.get('level')

    if (!companiesParam) {
      return NextResponse.json({ error: 'Provide companies param e.g. ?companies=google,microsoft' }, { status: 400 })
    }

    const companyNames = companiesParam.split(',').map(c => c.trim())

    const results = await Promise.all(
      companyNames.map(async (name) => {
        const where: any = {
          company: { name: { contains: name, mode: 'insensitive' } }
        }
        if (level) where.rawLevel = { equals: level, mode: 'insensitive' }

        const records = await prisma.salary.findMany({
          where,
          select: {
            totalComp: true,
            baseSalary: true,
            stockGrant: true,
            bonus: true,
            normalizedRole: true,
            rawLevel: true
          }
        })

        if (records.length === 0) {
          return { company: name, message: 'No data found' }
        }

        const totals = records.map(r => Number(r.totalComp))
        const avg = totals.reduce((a, b) => a + b, 0) / totals.length

        return {
          company: name,
          dataPoints: records.length,
          averageTotalComp: Math.round(avg),
          maxTotalComp: Math.max(...totals),
          minTotalComp: Math.min(...totals),
          averageBase: Math.round(records.map(r => Number(r.baseSalary)).reduce((a, b) => a + b, 0) / records.length),
          averageStock: Math.round(records.map(r => Number(r.stockGrant)).reduce((a, b) => a + b, 0) / records.length),
          averageBonus: Math.round(records.map(r => Number(r.bonus)).reduce((a, b) => a + b, 0) / records.length),
        }
      })
    )

    return NextResponse.json({ success: true, level: level || 'all', comparison: results })

  } catch (error) {
    console.error('Compare Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
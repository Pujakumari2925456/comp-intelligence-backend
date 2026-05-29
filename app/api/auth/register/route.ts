import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../../../../lib/prisma'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = RegisterSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 })
    }

    const { email, password } = validation.data

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { email, password: hashedPassword }
    })

    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      userId: user.id
    }, { status: 201 })

  } catch (error) {
    console.error('Register Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
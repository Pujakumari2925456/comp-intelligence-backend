import jwt from 'jsonwebtoken'

export function verifyToken(request: Request): { userId: string; email: string } | null {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string; email: string }
    return decoded
  } catch {
    return null
  }
}
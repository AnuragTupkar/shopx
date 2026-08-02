import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { User } from './models.js'

export interface AuthRequest extends Request { user?: { id: string; role: 'customer' | 'admin'; email: string } }
const cookieName = 'shopx_session'

export function setSession(response: Response, user: { _id: unknown; role: 'customer' | 'admin'; email: string }) {
  const token = jwt.sign({ sub: String(user._id), role: user.role, email: user.email }, config.JWT_SECRET, { expiresIn: '7d' })
  response.cookie(cookieName, token, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' })
}
export function clearSession(response: Response) { response.clearCookie(cookieName, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax', path: '/' }) }

export async function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[cookieName]
    if (!token) return response.status(401).json({ message: 'Please sign in to continue.' })
    const payload = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload
    const user = await User.findById(payload.sub).lean()
    if (!user) return response.status(401).json({ message: 'Session is no longer valid.' })
    request.user = { id: String(user._id), role: user.role, email: user.email }
    next()
  } catch { response.status(401).json({ message: 'Please sign in to continue.' }) }
}
export function requireAdmin(request: AuthRequest, response: Response, next: NextFunction) {
  if (request.user?.role !== 'admin') return response.status(403).json({ message: 'Administrator access required.' })
  next()
}
export function publicUser(user: { _id: unknown; name: string; email: string; phone?: string; role: string }) { return { id: String(user._id), name: user.name, email: user.email, phone: user.phone ?? '', role: user.role } }

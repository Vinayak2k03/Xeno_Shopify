import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export interface JWTPayload {
  userId: string
  email: string
  name: string
  iat?: number
  exp?: number
}

export class JWTService {
  // Generate JWT token
  static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET as string, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions)
  }

  // Verify JWT token
  static verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
      return decoded
    } catch (error) {
      console.error('JWT verification failed:', error)
      return null
    }
  }

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return await bcrypt.hash(password, saltRounds)
  }

  // Compare password
  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword)
  }

  // Extract token from Authorization header
  static extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }
    return authHeader.substring(7)
  }

  // Extract token from cookies (works with both client and server)
  static extractTokenFromCookies(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null
    
    const cookies = cookieHeader.split('; ')
    const authCookie = cookies.find(cookie => cookie.startsWith('auth-token='))
    
    if (authCookie) {
      return authCookie.split('=')[1]
    }
    
    return null
  }

  // Extract token from browser cookies (client-side only)
  static extractTokenFromBrowserCookies(): string | null {
    if (typeof document === 'undefined') return null
    
    const cookies = document.cookie.split('; ')
    const authCookie = cookies.find(cookie => cookie.startsWith('auth-token='))
    
    if (authCookie) {
      return authCookie.split('=')[1]
    }
    
    return null
  }
}
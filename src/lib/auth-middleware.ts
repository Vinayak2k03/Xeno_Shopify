import { NextRequest } from 'next/server'
import { JWTService, JWTPayload } from './jwt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getAuthenticatedUser(request: NextRequest): Promise<any | null> {
  try {
    console.log('=== JWT Authentication ===')
    
    // Method 1: Try Authorization header
    const authHeader = request.headers.get('authorization')
    let token = JWTService.extractTokenFromHeader(authHeader)
    
    if (!token) {
      // Method 2: Try cookies (httpOnly cookies from server)
      const cookieHeader = request.headers.get('cookie')
      token = JWTService.extractTokenFromCookies(cookieHeader)
    }

    if (!token) {
      // Method 3: Try NextJS cookies API
      const cookieToken = request.cookies.get('auth-token')
      if (cookieToken) {
        token = cookieToken.value
      }
    }

    if (!token) {
      console.log('No token found in headers or cookies')
      return null
    }

    console.log('Token found, verifying...')
    
    // Verify the token
    const payload = JWTService.verifyToken(token)
    
    if (!payload) {
      console.log('Token verification failed')
      return null
    }

    console.log('Token verified for user:', payload.email)

    // Get user from database to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    })

    if (!user) {
      console.log('User not found in database')
      return null
    }

    console.log('User authenticated successfully:', user.email)
    
    // Return user with consistent format
    return {
      $id: user.id,
      email: user.email,
      name: user.name,
      id: user.id,
    }

  } catch (error) {
    console.error('Authentication error:', error)
    return null
  } finally {
    await prisma.$disconnect()
  }
}
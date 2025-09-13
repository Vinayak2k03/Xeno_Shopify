import { JWTService } from './jwt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface User {
  id: string
  email: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface AuthResponse {
  user: User
  token: string
}

export class AuthService {
  // Create account with email and password
  static async createAccount(email: string, password: string, name: string): Promise<User> {
    try {
      console.log('Creating account for:', email)

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        throw new Error('User already exists with this email')
      }

      // Hash password
      const hashedPassword = await JWTService.hashPassword(password)

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
        }
      })

      console.log('Account created successfully for:', email)
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    } catch (error) {
      console.error('Create account error:', error)
      throw error
    } finally {
      await prisma.$disconnect()
    }
  }

  // Sign in with email and password
  static async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('Attempting sign in for:', email)

      // Find user
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        throw new Error('Invalid email or password')
      }

      if (!user.password) {
        throw new Error('Password not set for this account')
      }

      // Verify password
      const isValidPassword = await JWTService.comparePassword(password, user.password)

      if (!isValidPassword) {
        throw new Error('Invalid email or password')
      }

      // Generate JWT token
      const token = JWTService.generateToken({
        userId: user.id,
        email: user.email,
        name: user.name,
      })

      console.log('Sign in successful for:', email)

      // Store token in localStorage on client side
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth-token', token)
        console.log('Token stored in localStorage')
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        token
      }
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    } finally {
      await prisma.$disconnect()
    }
  }

  // Get current user from token
  static async getCurrentUser(): Promise<User | null> {
    try {
      const token = this.getToken()
      
      if (!token) {
        return null
      }

      const payload = JWTService.verifyToken(token)
      
      if (!payload) {
        // Clear invalid token
        this.clearToken()
        return null
      }

      // Get fresh user data from database
      const user = await prisma.user.findUnique({
        where: { id: payload.userId }
      })

      if (!user) {
        this.clearToken()
        return null
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    } catch (error) {
      console.error('Get current user error:', error)
      this.clearToken()
      return null
    } finally {
      await prisma.$disconnect()
    }
  }

  // Get token from localStorage or cookies
  static getToken(): string | null {
    if (typeof window === 'undefined') return null

    // Try localStorage first
    const token = localStorage.getItem('auth-token')
    if (token) {
      return token
    }

    // Try cookies as fallback
    const cookies = document.cookie.split('; ')
    const authCookie = cookies.find(cookie => cookie.startsWith('auth-token='))
    
    if (authCookie) {
      return authCookie.split('=')[1]
    }

    return null
  }

  // Set token in both localStorage and cookies
  static setToken(token: string): void {
    if (typeof window === 'undefined') return

    // Set in localStorage
    localStorage.setItem('auth-token', token)

    // Set in cookies (httpOnly=false so it can be read by JS)
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 7) // 7 days
    
    document.cookie = `auth-token=${token}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict`
  }

  // Clear token
  static clearToken(): void {
    if (typeof window === 'undefined') return

    // Clear localStorage
    localStorage.removeItem('auth-token')

    // Clear cookies
    document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  }

  // Sign out
  static async signOut(): Promise<void> {
    try {
      this.clearToken()
      console.log('Sign out successful')
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  // Check if user is authenticated
  static async isAuthenticated(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser()
      return !!user
    } catch (error) {
      return false
    }
  }

  // Update user profile
  static async updateProfile(updates: { name?: string; email?: string }): Promise<User> {
    try {
      const currentUser = await this.getCurrentUser()
      
      if (!currentUser) {
        throw new Error('Not authenticated')
      }

      const updatedUser = await prisma.user.update({
        where: { id: currentUser.id },
        data: updates
      })

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      }
    } catch (error) {
      console.error('Update profile error:', error)
      throw error
    } finally {
      await prisma.$disconnect()
    }
  }

  // Change password
  static async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.getCurrentUser()
      
      if (!user) {
        throw new Error('Not authenticated')
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id }
      })

      if (!dbUser || !dbUser.password) {
        throw new Error('User not found')
      }

      // Verify current password
      const isValidPassword = await JWTService.comparePassword(currentPassword, dbUser.password)
      
      if (!isValidPassword) {
        throw new Error('Current password is incorrect')
      }

      // Hash new password
      const hashedNewPassword = await JWTService.hashPassword(newPassword)

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedNewPassword }
      })

      console.log('Password changed successfully')
    } catch (error) {
      console.error('Change password error:', error)
      throw error
    } finally {
      await prisma.$disconnect()
    }
  }
}
export interface User {
  id: string
  email: string
  name: string
  createdAt?: Date
  updatedAt?: Date
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

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
        credentials: 'include', // Include cookies
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Account creation failed')
      }

      const data = await response.json()
      console.log('Account created successfully for:', email)
      
      return data.user
    } catch (error) {
      console.error('Create account error:', error)
      throw error
    }
  }

  // Sign in with email and password
  static async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('Attempting sign in for:', email)

      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Include cookies
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Sign in failed')
      }

      const data = await response.json()
      console.log('Sign in successful for:', email)

      // Store token in localStorage for client-side requests
      if (data.token) {
        localStorage.setItem('auth-token', data.token)
      }

      return data
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  // Get current user from server
  static async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.getToken() ? { 'Authorization': `Bearer ${this.getToken()}` } : {}),
        },
        credentials: 'include', // Include cookies
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Clear invalid token
          this.clearToken()
          return null
        }
        throw new Error('Failed to get current user')
      }

      const data = await response.json()
      return data.user
    } catch (error) {
      console.error('Get current user error:', error)
      this.clearToken()
      return null
    }
  }

  // Get token from localStorage
  static getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth-token')
  }

  // Set token in localStorage
  static setToken(token: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('auth-token', token)
  }

  // Clear token from localStorage
  static clearToken(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('auth-token')
  }

  // Sign out
  static async signOut(): Promise<void> {
    try {
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
      })

      // Clear token regardless of response
      this.clearToken()

      if (!response.ok) {
        console.warn('Sign out request failed, but cleared local token')
      }

      console.log('Sign out successful')
    } catch (error) {
      console.error('Sign out error:', error)
      // Clear token even if request fails
      this.clearToken()
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
}
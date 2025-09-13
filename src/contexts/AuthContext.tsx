'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthService, User } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check authentication status on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      setLoading(true)
      console.log('Checking authentication status...')
      
      const currentUser = await AuthService.getCurrentUser()
      console.log('Current user:', currentUser)
      
      setUser(currentUser)
    } catch (error) {
      console.error('Auth check error:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log('Attempting to sign in with:', email)
      
      const { user: authUser, token } = await AuthService.signIn(email, password)
      
      // Store token
      AuthService.setToken(token)
      
      console.log('Sign in successful, user:', authUser)
      setUser(authUser)
    } catch (error: any) {
      console.error('SignIn error:', error)
      
      let errorMessage = 'Sign in failed'
      if (error.message) {
        errorMessage = error.message
      }
      
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    try {
      setLoading(true)
      console.log('Attempting to sign up with:', email)
      
      const newUser = await AuthService.createAccount(email, password, name)
      
      // Automatically sign in after account creation
      const { user: authUser, token } = await AuthService.signIn(email, password)
      
      // Store token
      AuthService.setToken(token)
      
      console.log('Sign up successful, user:', authUser)
      setUser(authUser)
    } catch (error: any) {
      console.error('SignUp error:', error)
      
      let errorMessage = 'Sign up failed'
      if (error.message) {
        errorMessage = error.message
      }
      
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      console.log('Signing out...')
      
      await AuthService.signOut()
      setUser(null)
      
      console.log('Sign out successful')
    } catch (error: any) {
      console.error('SignOut error:', error)
      // Even if signout fails, clear local state
      setUser(null)
      throw new Error(error.message || 'Sign out failed')
    } finally {
      setLoading(false)
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}